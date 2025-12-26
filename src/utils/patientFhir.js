export const ID_SYSTEM = "https://medicalcare.local/id-number";

export function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

export function trimId(v) {
  return String(v ?? "").trim();
}

export function hasMedplumSession() {
  try {
    return !!localStorage.getItem("medplum:access_token");
  } catch {
    return false;
  }
}

export function toDateInputValue(d) {
  if (!d) return "";
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
  const date = new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

/** ✅ NEW: returns first non-empty (trimmed) string / value */
function firstNonEmpty(...vals) {
  for (const v of vals) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string") {
      const t = v.trim();
      if (t !== "") return t;
      continue;
    }
    return v;
  }
  return "";
}

// ✅ address can be object OR array (FHIR)
function getAddr(p) {
  const addr = p?.address;
  return Array.isArray(addr) ? addr[0] : addr;
}

function pickStreet(p) {
  const addr = getAddr(p);
  const line0 = Array.isArray(addr?.line) ? addr.line[0] : undefined;

  return firstNonEmpty(
    p?.street,
    addr?.street,
    addr?.line1,
    line0,
    ""
  );
}

function pickCity(p) {
  const addr = getAddr(p);
  return firstNonEmpty(p?.city, addr?.city, addr?.town, "");
}

function pickZip(p) {
  const addr = getAddr(p);
  return firstNonEmpty(p?.zipCode, addr?.zipCode, addr?.postalCode, "");
}

export function normalizePatient(raw = {}) {
  const p = raw && typeof raw === "object" ? raw : {};

  const idNumber = trimId(p.idNumber || p.id || p.medplumId || "");
  const firstName = String(p.firstName ?? "").trim();
  const lastName = String(p.lastName ?? "").trim();

  // ✅ FIX: ignore empty dob string and fallback to other DOB fields
  const dobSource = firstNonEmpty(
    p.dob,
    p.dateOfBirth,
    p.birthDate,
    p.birthDateTime,
    ""
  );
  const dob = toDateInputValue(dobSource);

  const street = String(pickStreet(p) ?? "").trim();
  const city = String(pickCity(p) ?? "").trim();
  const zipCode = String(pickZip(p) ?? "").trim();

  const status = p.status || p.clinicalStatus || "Active";
  const gender = p.gender || "Other";

  const conditions = Array.isArray(p.conditions)
    ? p.conditions
    : typeof p.conditions === "string"
    ? p.conditions
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
    : [];

  return {
    ...p,
    idNumber,
    id: p.id || idNumber,
    medplumId: p.medplumId || p.id || undefined,
    firstName,
    lastName,
    dob,
    gender,
    status,
    clinicalStatus: p.clinicalStatus || status,

    // keep flat fields for your UI
    street,
    city,
    zipCode,

    conditions,
    history: ensureArray(p.history),
    reports: ensureArray(p.reports),
  };
}

export function toFhirPatient(patient) {
  const p = normalizePatient(patient);
  const hasAddress = !!(p.street || p.city || p.zipCode);

  return {
    resourceType: "Patient",
    id: p.medplumId || undefined,
    identifier: p.idNumber ? [{ system: ID_SYSTEM, value: p.idNumber }] : undefined,
    name: [
      {
        family: p.lastName || undefined,
        given: p.firstName ? [p.firstName] : undefined,
      },
    ],
    gender: p.gender ? String(p.gender).toLowerCase() : undefined,
    birthDate: p.dob || undefined,
    address: hasAddress
      ? [
          {
            line: p.street ? [p.street] : undefined,
            city: p.city || undefined,
            postalCode: p.zipCode || undefined,
          },
        ]
      : undefined,
  };
}

export function fromFhirPatient(fhir) {
  const identifier = Array.isArray(fhir?.identifier)
    ? fhir.identifier.find((x) => x?.system === ID_SYSTEM) || fhir.identifier[0]
    : null;

  const name0 = Array.isArray(fhir?.name) ? fhir.name[0] : null;
  const given = Array.isArray(name0?.given) ? name0.given[0] : "";

  const addr0 = Array.isArray(fhir?.address) ? fhir.address[0] : null;
  const line0 = Array.isArray(addr0?.line) ? addr0.line[0] : "";

  return normalizePatient({
    medplumId: fhir?.id,
    idNumber: identifier?.value || "",
    firstName: given || "",
    lastName: name0?.family || "",
    dob: toDateInputValue(fhir?.birthDate),
    gender: fhir?.gender
      ? String(fhir.gender).charAt(0).toUpperCase() + String(fhir.gender).slice(1)
      : "Other",
    street: line0 || "",
    city: addr0?.city || "",
    zipCode: addr0?.postalCode || "",
  });
}

export function historyItemToObservation() {
  throw new Error("historyItemToObservation not implemented");
}

export function reportToDiagnosticReport() {
  throw new Error("reportToDiagnosticReport not implemented");
}
