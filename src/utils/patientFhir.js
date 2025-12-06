import { medplum } from "../medplumClient";

export const ID_SYSTEM = "https://medicalcare.local/id-number";

// Helpers
export const ensureArray = (value) =>
  Array.isArray(value) ? value : [];

export const trimId = (id) => String(id || "").trim();

const firstItem = (arr) =>
  Array.isArray(arr) && arr.length ? arr[0] : {};

const findTelecom = (telecom, system) =>
  (telecom.find((t) => t.system === system) || {}).value || "";

const findExtension = (extensions, url) =>
  (extensions.find((ext) => ext.url === url) || {}).valueString || "";

// Normalize patient structure
export const normalizePatient = (p) => ({
  ...p,
  medplumId: p.medplumId || null,
  history: ensureArray(p.history).map((item) => ({
    ...item,
    audioData: item.audioData || null,
  })),
  reports: ensureArray(p.reports),
});

// Convert TO FHIR Patient
export function toFhirPatient(patient) {
  return {
    resourceType: "Patient",
    identifier: [
      {
        system: ID_SYSTEM,
        value: patient.idNumber || "",
      },
    ],
    name: [
      {
        given: [patient.firstName || ""],
        family: patient.lastName || "",
      },
    ],
    birthDate: patient.dateOfBirth || "",
    gender: patient.gender || "",
    telecom: [
      patient.phone && { system: "phone", value: patient.phone },
      patient.email && { system: "email", value: patient.email },
    ].filter(Boolean),
    address: [
      {
        text: patient.address || "",
        city: patient.city || "",
        country: patient.country || "",
      },
    ],
    extension: [
      patient.medicalIssues && {
        url: "medical-issues",
        valueString: patient.medicalIssues,
      },
      patient.clinicalStatus && {
        url: "clinical-status",
        valueString: patient.clinicalStatus,
      },
      patient.notes && {
        url: "notes",
        valueString: patient.notes,
      },
    ].filter(Boolean),
  };
}

// History item -> FHIR Observation (with audioData support)
export function historyItemToObservation(patient, item, index) {
  const idNumber = trimId(patient.idNumber);
  const patientId = patient.medplumId || idNumber || "patient";
  const patientRef = `Patient/${patientId}`;

  const resource = {
    resourceType: "Observation",
    id: item.id || `${idNumber || "patient"}-history-${index + 1}`,
    status: "final",
    subject: { reference: patientRef },
    effectiveDateTime: item.date || "",
    code: {
      text: item.title || item.type || "History item",
    },
    valueString: item.summary || "",
  };

  if (item.audioData) {
    resource.extension = resource.extension || [];
    resource.extension.push({
      url: "https://medicalcare.local/extension/audioData",
      valueString: item.audioData,
    });
  }

  return resource;
}

// History item -> FHIR Media (for audio recording)
export function historyItemToMedia(patient, item) {
  const idNumber = trimId(patient.idNumber);
  const patientId = patient.medplumId || idNumber || "patient";
  const patientRef = `Patient/${patientId}`;

  if (!item.audioData) {
    return null;
  }

  const resource = {
    resourceType: "Media",
    status: "completed",
    subject: { reference: patientRef },
    createdDateTime: item.date || new Date().toISOString(),
    type: {
      text: item.type || "audio-recording",
    },
    content: {
      contentType: item.audioContentType || "audio/webm",
      data: item.audioData.split(",")[1] || item.audioData, // Extract base64 data if it's a data URL
    },
  };

  if (item.title || item.summary) {
    resource.note = [
      {
        text: `${item.title || ""}${item.title && item.summary ? " - " : ""}${
          item.summary || ""
        }`.trim(),
      },
    ];
  }

  return resource;
}

// Report item -> FHIR DiagnosticReport
export function reportToDiagnosticReport(patient, report, index) {
  const idNumber = trimId(patient.idNumber);
  const patientId = patient.medplumId || idNumber || "patient";
  const patientRef = `Patient/${patientId}`;

  return {
    resourceType: "DiagnosticReport",
    id: report.id || `${idNumber || "patient"}-report-${index + 1}`,
    status: "final",
    subject: { reference: patientRef },
    effectiveDateTime: report.date || report.uploadedAt || "",
    code: {
      text: report.type || "Report",
    },
    conclusion: report.description || report.name || "",
  };
}

// Convert FROM FHIR Patient
export function fromFhirPatient(fhirPatient) {
  const identifiers = ensureArray(fhirPatient.identifier);

  const idIdentifier =
    identifiers.find((i) => i.system === ID_SYSTEM) ||
    identifiers[0] ||
    { value: fhirPatient.id || "" };

  const name = firstItem(fhirPatient.name);
  const given = Array.isArray(name.given) ? name.given[0] || "" : "";
  const telecom = ensureArray(fhirPatient.telecom);
  const address = firstItem(fhirPatient.address);
  const extensions = ensureArray(fhirPatient.extension);

  return normalizePatient({
    medplumId: fhirPatient.id || null,
    idNumber: trimId(idIdentifier.value),
    firstName: given,
    lastName: name.family || "",
    dateOfBirth: fhirPatient.birthDate || "",
    gender: fhirPatient.gender || "",
    phone: findTelecom(telecom, "phone"),
    email: findTelecom(telecom, "email"),
    address: address.text || "",
    city: address.city || "",
    country: address.country || "",
    medicalIssues: findExtension(extensions, "medical-issues"),
    clinicalStatus: findExtension(extensions, "clinical-status"),
    notes: findExtension(extensions, "notes"),
  });
}

// Medplum session helper
export const hasMedplumSession = () => {
  try {
    // Check if medplum client exists and is authenticated
    if (!medplum) return false;
    const isAuth = medplum.isAuthenticated();
    // Also verify we can get profile (double check)
    if (isAuth) {
      try {
        const profile = medplum.getProfile();
        return !!profile;
      } catch {
        return false;
      }
    }
    return false;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("hasMedplumSession check failed:", error);
    }
    return false;
  }
};

/*
 * FILE DOCUMENTATION: src/utils/patientFhir.js
 * 
 * Utility functions for converting between application data structures
 * and FHIR (Fast Healthcare Interoperability Resources) format.
 * 
 * FUNCTIONS:
 * 
 * 1. normalizePatient(patient):
 *    - Ensures consistent patient data structure
 *    - Normalizes arrays (history, reports)
 *    - Sets default values for optional fields
 * 
 * 2. toFhirPatient(patient):
 *    - Converts application patient object to FHIR Patient resource
 *    - Maps all fields to FHIR structure
 *    - Handles identifiers, names, addresses, extensions
 * 
 * 3. fromFhirPatient(fhirPatient):
 *    - Converts FHIR Patient resource to application format
 *    - Extracts identifiers, names, contact info
 *    - Handles extensions for custom fields
 * 
 * 4. historyItemToObservation(patient, item, index):
 *    - Converts history item to FHIR Observation resource
 *    - Includes audioData as extension if present
 *    - Links to patient via subject reference
 * 
 * 5. historyItemToMedia(patient, item):
 *    - Converts audio history item to FHIR Media resource
 *    - Extracts base64 audio data
 *    - Creates proper Media resource structure
 * 
 * 6. reportToDiagnosticReport(patient, report, index):
 *    - Converts report to FHIR DiagnosticReport resource
 *    - Maps report metadata to FHIR structure
 *    - Links to patient via subject reference
 * 
 * 7. hasMedplumSession():
 *    - Checks if Medplum client is authenticated
 *    - Verifies session validity
 *    - Returns boolean indicating connection status
 * 
 * CONSTANTS:
 * - ID_SYSTEM: FHIR identifier system URL for patient ID numbers
 * 
 * HELPER FUNCTIONS:
 * - ensureArray: Converts value to array if not already
 * - trimId: Normalizes ID number strings
 * - findTelecom: Extracts telecom value by system
 * - findExtension: Extracts extension value by URL
 * 
 * FHIR RESOURCE TYPES:
 * - Patient: Core patient demographics
 * - Observation: Treatment history items
 * - Media: Audio recordings
 * - DiagnosticReport: PDF reports
 * 
 * EXTENSIONS:
 * - audioData: Stored in Observation.extension
 * - medicalIssues: Stored in Patient.extension
 * - clinicalStatus: Stored in Patient.extension
 * - notes: Stored in Patient.extension
 */
