export const ID_SYSTEM = "https://medicalcare.local/id-number";

export function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

export function trimId(v) {
  return String(v ?? "").trim();
}

<<<<<<< HEAD
function safeJsonParse(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasMedplumSession() {
  try {
    const keys = [
      "activeLogin",
      "logins",
      "medplum:activeLogin",
      "medplum:logins",
      "medplum:access_token",
    ];

    for (const k of keys) {
      const raw = localStorage.getItem(k);
      if (!raw) continue;

      if (k.endsWith("activeLogin")) {
        const obj = safeJsonParse(raw);
        if (
          obj &&
          (obj.accessToken || obj.refreshToken || obj.profile || obj.project)
        ) {
          return true;
        }
        if (raw.length > 20) return true;
      }

      if (k.endsWith("logins")) {
        const arr = safeJsonParse(raw);
        if (Array.isArray(arr) && arr.length > 0) return true;
        if (raw.length > 20) return true;
      }

      if (k.endsWith("access_token") && raw.length > 20) return true;
    }

    return false;
=======
export function hasMedplumSession() {
  try {
    return !!localStorage.getItem("medplum:access_token");
>>>>>>> refactor-ui-cleanup
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

<<<<<<< HEAD
=======
/** ✅ NEW: returns first non-empty (trimmed) string / value */
>>>>>>> refactor-ui-cleanup
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

<<<<<<< HEAD
function normalizeGenderUi(value) {
  const v = String(value ?? "").trim().toLowerCase();

  if (!v) return "Other";

  if (v === "male" || v === "m" || v === "man" || v === "boy") return "Male";
  if (v === "female" || v === "f" || v === "woman" || v === "girl")
    return "Female";

  if (v === "other") return "Other";
  if (v === "unknown" || v === "u") return "Other";

  if (v === "זכר" || v === "גבר") return "Male";
  if (v === "נקבה" || v === "אישה") return "Female";
  if (v === "אחר" || v === "אחרת") return "Other";

  return "Other";
}

function toFhirGender(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return undefined;

  if (v === "male" || v === "m" || v === "man" || v === "boy") return "male";
  if (v === "female" || v === "f" || v === "woman" || v === "girl")
    return "female";

  if (v === "other") return "other";
  if (v === "unknown" || v === "u") return "unknown";

  if (v === "זכר" || v === "גבר") return "male";
  if (v === "נקבה" || v === "אישה") return "female";
  if (v === "אחר" || v === "אחרת") return "other";

  return undefined;
}

=======
// ✅ address can be object OR array (FHIR)
>>>>>>> refactor-ui-cleanup
function getAddr(p) {
  const addr = p?.address;
  return Array.isArray(addr) ? addr[0] : addr;
}

function pickStreet(p) {
  const addr = getAddr(p);
  const line0 = Array.isArray(addr?.line) ? addr.line[0] : undefined;

<<<<<<< HEAD
  return firstNonEmpty(p?.street, addr?.street, addr?.line1, line0, "");
=======
  return firstNonEmpty(
    p?.street,
    addr?.street,
    addr?.line1,
    line0,
    ""
  );
>>>>>>> refactor-ui-cleanup
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

<<<<<<< HEAD
=======
  // ✅ FIX: ignore empty dob string and fallback to other DOB fields
>>>>>>> refactor-ui-cleanup
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
<<<<<<< HEAD
  const gender = normalizeGenderUi(p.gender);
=======
  const gender = p.gender || "Other";
>>>>>>> refactor-ui-cleanup

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
<<<<<<< HEAD
    street,
    city,
    zipCode,
=======

    // keep flat fields for your UI
    street,
    city,
    zipCode,

>>>>>>> refactor-ui-cleanup
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
<<<<<<< HEAD
    identifier: p.idNumber
      ? [{ system: ID_SYSTEM, value: p.idNumber }]
      : undefined,
=======
    identifier: p.idNumber ? [{ system: ID_SYSTEM, value: p.idNumber }] : undefined,
>>>>>>> refactor-ui-cleanup
    name: [
      {
        family: p.lastName || undefined,
        given: p.firstName ? [p.firstName] : undefined,
      },
    ],
<<<<<<< HEAD
    gender: toFhirGender(p.gender),
=======
    gender: p.gender ? String(p.gender).toLowerCase() : undefined,
>>>>>>> refactor-ui-cleanup
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
<<<<<<< HEAD
    gender: normalizeGenderUi(fhir?.gender),
=======
    gender: fhir?.gender
      ? String(fhir.gender).charAt(0).toUpperCase() + String(fhir.gender).slice(1)
      : "Other",
>>>>>>> refactor-ui-cleanup
    street: line0 || "",
    city: addr0?.city || "",
    zipCode: addr0?.postalCode || "",
  });
}

<<<<<<< HEAD
export function historyItemToObservation(patient, item, index = 0) {
  const p = normalizePatient(patient);
  const h = item && typeof item === "object" ? item : {};

  return {
    resourceType: "Observation",
    status: "final",
    subject: { reference: `Patient/${p.medplumId || p.idNumber}` },
    effectiveDateTime: h.date || new Date().toISOString(),
    code: { text: h.title || `History item ${index + 1}` },
    note: h.summary ? [{ text: String(h.summary) }] : undefined,
    valueString: h.summary ? String(h.summary) : undefined,
    extension: h.audioData
      ? [
          {
            url: "https://medicalcare.local/extension/audioData",
            valueString: String(h.audioData),
          },
        ]
      : undefined,
  };
}

export function reportToDiagnosticReport(patient, report, index = 0) {
  const p = normalizePatient(patient);
  const r = report && typeof report === "object" ? report : {};

  return {
    resourceType: "DiagnosticReport",
    status: "final",
    subject: { reference: `Patient/${p.medplumId || p.idNumber}` },
    effectiveDateTime: r.date || r.uploadedAt || new Date().toISOString(),
    code: { text: r.name || r.type || `Report ${index + 1}` },
    conclusion: r.description ? String(r.description) : undefined,
  };
=======
export function historyItemToObservation() {
  throw new Error("historyItemToObservation not implemented");
}

export function reportToDiagnosticReport() {
  throw new Error("reportToDiagnosticReport not implemented");
>>>>>>> refactor-ui-cleanup
}
