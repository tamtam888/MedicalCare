// utils/fhirPatient.js
import { medplum } from "../medplumClient";

export const ID_SYSTEM = "https://medicalcare.local/id-number";

export function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

export function trimId(v) {
  return String(v ?? "").trim();
}

/**
 * ✅ FIX:
 * Don't rely on a hard-coded localStorage key.
 * Ask the Medplum client if we have a session (token/profile).
 */
export function hasMedplumSession() {
  try {
    const token =
      typeof medplum?.getAccessToken === "function" ? medplum.getAccessToken() : null;
    if (token && String(token).trim().length > 10) return true;

    const profile =
      typeof medplum?.getProfile === "function" ? medplum.getProfile() : null;
    if (profile && typeof profile === "object" && profile.resourceType) return true;

    return false;
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

function getAddr(p) {
  const addr = p?.address;
  return Array.isArray(addr) ? addr[0] : addr;
}

function pickStreet(p) {
  const addr = getAddr(p);
  const line0 = Array.isArray(addr?.line) ? addr.line[0] : undefined;
  return firstNonEmpty(p?.street, addr?.street, addr?.line1, line0, "");
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

  const dobSource = firstNonEmpty(p.dob, p.dateOfBirth, p.birthDate, p.birthDateTime, "");
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

/**
 * ✅ Implemented:
 * Convert one local "history item" into an Observation for Medplum.
 *
 * history item shape in your app:
 * { id, type, title, date, summary, audioData }
 */
export function historyItemToObservation(patient, historyItem, index = 0) {
  const p = normalizePatient(patient);
  const it = historyItem && typeof historyItem === "object" ? historyItem : {};

  const when = it.date || new Date().toISOString();
  const title = String(it.title || "History item").trim() || "History item";
  const summary = String(it.summary || "").trim();

  const obs = {
    resourceType: "Observation",
    status: "final",
    subject: p.medplumId ? { reference: `Patient/${p.medplumId}` } : undefined,
    effectiveDateTime: when,
    code: { text: title },
    note: summary ? [{ text: summary }] : [],
  };

  // keep your existing audio extension convention
  if (it.audioData) {
    obs.extension = [
      {
        url: "https://medicalcare.local/extension/audioData",
        valueString: String(it.audioData),
      },
    ];
  }

  // optional: tag the type if you want (doesn't break anything)
  const t = String(it.type || "").trim();
  if (t) {
    obs.category = [{ text: t }];
  }

  // avoid setting obs.id (server will assign). Keep client reference in identifier if needed.
  const localId = String(it.id || "").trim();
  if (localId) {
    obs.identifier = [
      {
        system: "https://medicalcare.local/history-item-id",
        value: localId,
      },
    ];
  }

  return obs;
}

/**
 * ✅ Implemented:
 * Convert one local report meta into a DiagnosticReport for Medplum.
 *
 * report shape in your app:
 * { id, name, type, date, uploadedAt, description }
 */
export function reportToDiagnosticReport(patient, report, index = 0) {
  const p = normalizePatient(patient);
  const r = report && typeof report === "object" ? report : {};

  const when = r.uploadedAt || r.date || new Date().toISOString();
  const name = String(r.name || r.type || "Report").trim() || "Report";
  const desc = String(r.description || "").trim();

  const dr = {
    resourceType: "DiagnosticReport",
    status: "final",
    subject: p.medplumId ? { reference: `Patient/${p.medplumId}` } : undefined,
    effectiveDateTime: when,
    code: { text: name },
    conclusion: desc || undefined,
  };

  const localId = String(r.id || "").trim();
  if (localId) {
    dr.identifier = [
      {
        system: "https://medicalcare.local/report-id",
        value: localId,
      },
    ];
  }

  return dr;
}
