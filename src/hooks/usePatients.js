import { useEffect, useState } from "react";
import { medplum } from "../medplumClient";

const STORAGE_KEY = "patients";
const BACKUP_KEY = "patients_backup";
const ID_SYSTEM = "https://medicalcare.local/id-number";

/** Helpers */
const ensureArray = (value) => (Array.isArray(value) ? value : []);
const trimId = (id) => String(id || "").trim();
const firstItem = (arr) => (Array.isArray(arr) && arr.length ? arr[0] : {});
const findTelecom = (telecom, system) =>
  (telecom.find((t) => t.system === system) || {}).value || "";
const findExtension = (extensions, url) =>
  (extensions.find((ext) => ext.url === url) || {}).valueString || "";

const normalizePatient = (p) => ({
  ...p,
  medplumId: p.medplumId || null,
  history: ensureArray(p.history),
  reports: ensureArray(p.reports),
});

/** Medplum session */
const hasMedplumSession = () => {
  try {
    const isAuth = medplum.isAuthenticated();
    console.log("hasMedplumSession:", isAuth);
    return isAuth;
  } catch (error) {
    console.warn("Medplum auth check failed", error);
    return false;
  }
};

/** Convert TO FHIR Patient */
function toFhirPatient(patient) {
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

/** History item -> FHIR Observation */
function historyItemToObservation(patient, item, index) {
  const patientRef = `Patient/${patient.idNumber || ""}`;
  return {
    resourceType: "Observation",
    id: item.id || `${patient.idNumber || "patient"}-history-${index + 1}`,
    status: "final",
    subject: { reference: patientRef },
    effectiveDateTime: item.date || "",
    code: {
      text: item.title || item.type || "History item",
    },
    valueString: item.summary || "",
  };
}

/** Report item -> FHIR DiagnosticReport */
function reportToDiagnosticReport(patient, report, index) {
  const patientRef = `Patient/${patient.idNumber || ""}`;
  return {
    resourceType: "DiagnosticReport",
    id: report.id || `${patient.idNumber || "patient"}-report-${index + 1}`,
    status: "final",
    subject: { reference: patientRef },
    effectiveDateTime: report.date || report.uploadedAt || "",
    code: {
      text: report.type || "Report",
    },
    conclusion: report.description || report.name || "",
  };
}

/** Convert FROM FHIR Patient */
function fromFhirPatient(fhirPatient) {
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

export function usePatients() {
  /** Load from localStorage with backup support */
  const [patients, setPatients] = useState(() => {
    try {
      let parsed = [];
      let parsedBackup = [];

      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const tmp = JSON.parse(stored);
          if (Array.isArray(tmp)) {
            parsed = tmp;
          }
        } catch (e) {
          console.error("Failed to parse patients from STORAGE_KEY", e);
        }
      }

      const backup = localStorage.getItem(BACKUP_KEY);
      if (backup) {
        try {
          const tmpBackup = JSON.parse(backup);
          if (Array.isArray(tmpBackup)) {
            parsedBackup = tmpBackup;
          }
        } catch (e) {
          console.error("Failed to parse patients from BACKUP_KEY", e);
        }
      }

      if (parsed.length > 0) {
        console.log("Loaded patients from STORAGE_KEY", parsed);
        return parsed.map(normalizePatient);
      }

      if (parsedBackup.length > 0) {
        console.warn(
          "Loaded patients from BACKUP_KEY because STORAGE_KEY was empty"
        );
        return parsedBackup.map(normalizePatient);
      }

      console.log("No patients found in storage, starting with empty list");
      return [];
    } catch (error) {
      console.error("Failed to load patients from storage", error);
      return [];
    }
  });

  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatientIdNumber, setSelectedPatientIdNumber] =
    useState(null);

  /** Save to localStorage with backup */
  useEffect(() => {
    try {
      const json = JSON.stringify(patients);
      localStorage.setItem(STORAGE_KEY, json);

      if (Array.isArray(patients) && patients.length > 0) {
        localStorage.setItem(BACKUP_KEY, json);
      }

      console.log("Saved patients to localStorage", patients);
    } catch (error) {
      console.error("Failed to save patients to localStorage", error);
    }
  }, [patients]);

  /** Initial sync from Medplum if local storage is empty but Medplum has data */
  useEffect(() => {
    async function syncFromMedplumIfEmpty() {
      if (!hasMedplumSession()) {
        return;
      }

      if (patients && patients.length > 0) {
        return;
      }

      try {
        console.log(
          "[Medplum sync] Local patients empty, loading from Medplum"
        );
        const bundle = await medplum.search("Patient", {
          _count: 100,
        });

        const resources = Array.isArray(bundle.entry)
          ? bundle.entry
              .map((e) => e.resource)
              .filter((r) => r && r.resourceType === "Patient")
          : [];

        const imported = resources.map(fromFhirPatient);

        if (imported.length > 0) {
          setPatients((prev) => {
            if (prev && prev.length > 0) {
              return prev;
            }
            console.log(
              "[Medplum sync] Setting patients from Medplum search",
              imported
            );
            return imported;
          });
        }
      } catch (error) {
        console.error(
          "[Medplum sync] Failed to load patients from Medplum",
          error
        );
      }
    }

    syncFromMedplumIfEmpty();
  }, [patients, setPatients]);

  const selectedPatient =
    patients.find(
      (p) => trimId(p.idNumber) === trimId(selectedPatientIdNumber)
    ) || null;

  const selectedPatientFullName = selectedPatient
    ? [selectedPatient.firstName, selectedPatient.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  /** Create patient */
  const handleCreatePatient = async (formData) => {
    const createdAt = new Date().toISOString();
    const idNumber = trimId(formData.idNumber);

    const existsLocal = patients.some(
      (p) => trimId(p.idNumber) === idNumber
    );
    if (existsLocal) {
      alert("A patient with this ID number already exists.");
      return;
    }

    const newPatient = normalizePatient({
      ...formData,
      idNumber,
      history: [
        {
          id: crypto.randomUUID(),
          type: "Note",
          title: "Patient profile created",
          date: createdAt,
          summary: "Initial patient profile was created in the system.",
        },
      ],
      reports: [],
    });

    setPatients((prev) => [...prev, newPatient]);
    setSelectedPatientIdNumber(idNumber);
    setEditingPatient(null);

    /** Sync to Medplum */
    if (hasMedplumSession()) {
      try {
        const fhirPatient = toFhirPatient(newPatient);
        const created = await medplum.createResource(fhirPatient);

        if (created && created.id) {
          setPatients((prev) =>
            prev.map((p) =>
              trimId(p.idNumber) === idNumber
                ? { ...p, medplumId: created.id }
                : p
            )
          );
        }
      } catch (error) {
        console.error("Failed to create patient in Medplum", error);
      }
    }
  };

  /** Update patient from form (PatientsPage) */
  const handleUpdatePatient = async (updatedData) => {
    if (!editingPatient) return;

    const newIdNumber = trimId(updatedData.idNumber);
    const oldIdNumber = trimId(editingPatient.idNumber);

    if (newIdNumber !== oldIdNumber) {
      const exists = patients.some(
        (p) => trimId(p.idNumber) === newIdNumber
      );
      if (exists) {
        alert("Another patient already uses this ID number.");
        return;
      }
    }

    let updatedPatientRef = null;

    setPatients((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== oldIdNumber) return p;

        const updatedPatient = normalizePatient({
          ...p,
          ...updatedData,
          idNumber: newIdNumber,
        });

        updatedPatientRef = updatedPatient;
        return updatedPatient;
      })
    );

    setEditingPatient(null);
    setSelectedPatientIdNumber(newIdNumber);

    /** Sync with Medplum */
    if (hasMedplumSession() && updatedPatientRef) {
      try {
        const baseFhir = toFhirPatient(updatedPatientRef);

        if (updatedPatientRef.medplumId) {
          await medplum.updateResource({
            ...baseFhir,
            id: updatedPatientRef.medplumId,
          });
        } else {
          const searchBundle = await medplum.search("Patient", {
            identifier: `${ID_SYSTEM}|${newIdNumber}`,
          });

          const existingResource =
            searchBundle.entry?.[0]?.resource || null;

          if (existingResource) {
            await medplum.updateResource({
              ...existingResource,
              ...baseFhir,
              id: existingResource.id,
            });
          } else {
            await medplum.createResource(baseFhir);
          }
        }
      } catch (error) {
        console.error("Failed to update patient in Medplum", error);
      }
    }
  };

  /** Update patient directly from PatientDetailsPage */
  const handleUpdatePatientInline = async (updatedPatient) => {
    if (!updatedPatient) return;

    const idNumber = trimId(updatedPatient.idNumber);
    if (!idNumber) return;

    console.log("[handleUpdatePatientInline] incoming", updatedPatient);

    let updatedPatientRef = null;

    setPatients((prev) => {
      const next = prev.map((p) => {
        if (trimId(p.idNumber) !== idNumber) return p;

        const merged = normalizePatient({
          ...p,
          ...updatedPatient,
          idNumber,
        });

        updatedPatientRef = merged;
        return merged;
      });

      console.log("[handleUpdatePatientInline] after setPatients", next);
      return next;
    });

    setSelectedPatientIdNumber(idNumber);

    if (!hasMedplumSession() || !updatedPatientRef) {
      console.log("[handleUpdatePatientInline] skip Medplum sync");
      return;
    }

    try {
      const baseFhir = toFhirPatient(updatedPatientRef);

      if (updatedPatientRef.medplumId) {
        await medplum.updateResource({
          ...baseFhir,
          id: updatedPatientRef.medplumId,
        });
      } else {
        const searchBundle = await medplum.search("Patient", {
          identifier: `${ID_SYSTEM}|${idNumber}`,
        });

        const existingResource =
          searchBundle.entry?.[0]?.resource || null;

        if (existingResource) {
          await medplum.updateResource({
            ...existingResource,
            ...baseFhir,
            id: existingResource.id,
          });
        } else {
          await medplum.createResource(baseFhir);
        }
      }
    } catch (error) {
      console.error(
        "Failed to update patient from details page in Medplum",
        error
      );
    }
  };

  const handleCancelEdit = () => setEditingPatient(null);

  const handleEditPatient = (idNumber) => {
    const patient = patients.find(
      (p) => trimId(p.idNumber) === trimId(idNumber)
    );
    if (!patient) return;

    setEditingPatient(patient);
    setSelectedPatientIdNumber(idNumber);
  };

  /** Delete patient */
  const handleDeletePatient = async (idNumber) => {
    const id = trimId(idNumber);
    if (!id) return;

    const patient = patients.find((p) => trimId(p.idNumber) === id);

    if (hasMedplumSession() && patient) {
      try {
        let targetId = patient.medplumId || null;

        if (!targetId) {
          const searchBundle = await medplum.search("Patient", {
            identifier: `${ID_SYSTEM}|${id}`,
          });

          const existingResource =
            searchBundle.entry?.[0]?.resource || null;

          if (existingResource?.id) targetId = existingResource.id;
        }

        if (targetId) {
          await medplum.deleteResource("Patient", targetId);
        }
      } catch (error) {
        console.error("Failed to delete patient in Medplum", error);
        alert("Failed to delete patient from Medplum.");
        return;
      }
    }

    setPatients((prev) =>
      prev.filter((p) => trimId(p.idNumber) !== id)
    );

    if (trimId(selectedPatientIdNumber) === id) {
      setSelectedPatientIdNumber(null);
    }

    if (editingPatient && trimId(editingPatient.idNumber) === id) {
      setEditingPatient(null);
    }
  };

  /** Select */
  const handleSelectPatient = (idNumber) => {
    setSelectedPatientIdNumber(idNumber);
  };

  /** Add PDF Report */
  const handleAddReport = (idNumber, reportMeta) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimId(idNumber)) return p;

        const reports = [...ensureArray(p.reports), reportMeta];

        const history = [
          ...ensureArray(p.history),
          {
            id: reportMeta.id,
            type: "Report",
            title: `Report attached: ${reportMeta.name}`,
            date: reportMeta.uploadedAt,
            summary: "PDF report was attached to the patient profile.",
          },
        ];

        return { ...p, reports, history };
      })
    );
  };

  /** Export FHIR JSON (patients + history + reports) */
  const handleExportPatients = () => {
    if (!patients.length) {
      alert("No patients to export.");
      return;
    }

    const entries = [];

    patients.forEach((p) => {
      const patientResource = toFhirPatient(p);
      entries.push({ resource: patientResource });

      ensureArray(p.history).forEach((item, index) => {
        entries.push({
          resource: historyItemToObservation(p, item, index),
        });
      });

      ensureArray(p.reports).forEach((report, index) => {
        entries.push({
          resource: reportToDiagnosticReport(p, report, index),
        });
      });
    });

    const fhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: entries,
    };

    const blob = new Blob([JSON.stringify(fhirBundle, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "patients-fhir.json";
    link.click();
    URL.revokeObjectURL(url);
  };

  /** Import FHIR JSON (patients + history + reports) */
  const handleImportPatients = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);

        if (
          json.resourceType !== "Bundle" ||
          !Array.isArray(json.entry)
        ) {
          alert("Invalid FHIR JSON file.");
          return;
        }

        const resources = json.entry
          .map((entry) => entry.resource)
          .filter(Boolean);

        const patientResources = resources.filter(
          (res) => res.resourceType === "Patient"
        );
        const observationResources = resources.filter(
          (res) => res.resourceType === "Observation"
        );
        const diagnosticResources = resources.filter(
          (res) => res.resourceType === "DiagnosticReport"
        );

        const importedPatients = patientResources.map(fromFhirPatient);

        const historyByIdNumber = new Map();
        observationResources.forEach((obs) => {
          const ref = obs.subject?.reference || "";
          const match = ref.match(/^Patient\/(.+)$/);
          if (!match) return;
          const idNumber = trimId(match[1]);
          if (!idNumber) return;

          const list = historyByIdNumber.get(idNumber) || [];
          list.push({
            id: obs.id || crypto.randomUUID(),
            type: "Transcription",
            title: obs.code?.text || "History item",
            date: obs.effectiveDateTime || "",
            summary: obs.valueString || "",
          });
          historyByIdNumber.set(idNumber, list);
        });

        const reportsByIdNumber = new Map();
        diagnosticResources.forEach((dr) => {
          const ref = dr.subject?.reference || "";
          const match = ref.match(/^Patient\/(.+)$/);
          if (!match) return;
          const idNumber = trimId(match[1]);
          if (!idNumber) return;

          const list = reportsByIdNumber.get(idNumber) || [];
          list.push({
            id: dr.id || crypto.randomUUID(),
            name: dr.code?.text || "Report",
            type: dr.code?.text || "Report",
            date: dr.effectiveDateTime || "",
            uploadedAt: dr.effectiveDateTime || "",
            description: dr.conclusion || "",
          });
          reportsByIdNumber.set(idNumber, list);
        });

        setPatients((prev) => {
          const map = new Map(
            prev.map((p) => [trimId(p.idNumber), normalizePatient(p)])
          );

          importedPatients.forEach((imp) => {
            const key = trimId(imp.idNumber);
            if (!key) return;

            const importedHistory =
              historyByIdNumber.get(key) || [];
            const importedReports =
              reportsByIdNumber.get(key) || [];

            if (map.has(key)) {
              const existing = map.get(key);
              map.set(key, {
                ...existing,
                ...imp,
                history:
                  existing.history && existing.history.length
                    ? existing.history
                    : importedHistory,
                reports:
                  existing.reports && existing.reports.length
                    ? existing.reports
                    : importedReports,
              });
            } else {
              map.set(
                key,
                normalizePatient({
                  ...imp,
                  history: importedHistory,
                  reports: importedReports,
                })
              );
            }
          });

          return Array.from(map.values());
        });

        alert("Patients imported successfully.");
      } catch (error) {
        console.error("Failed to import patients", error);
        alert("Import failed.");
      }
    };

    reader.readAsText(file);
  };

  /** Save Transcription (always new entry) */
  const handleSaveTranscription = (idNumber, transcriptionText) => {
    const trimmedId = trimId(idNumber);
    const cleanText = transcriptionText?.trim();
    if (!trimmedId || !cleanText) return;

    const now = new Date().toISOString();

    setPatients((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimmedId) return p;

        const history = [...ensureArray(p.history)];

        history.push({
          id: crypto.randomUUID(),
          type: "Transcription",
          title: "Treatment transcription",
          date: now,
          summary: cleanText,
        });

        return { ...p, history };
      })
    );
  };

  return {
    patients,
    selectedPatient,
    selectedPatientFullName,
    editingPatient,

    handleCreatePatient,
    handleUpdatePatient,
    handleUpdatePatientInline,
    handleCancelEdit,
    handleEditPatient,
    handleDeletePatient,
    handleSelectPatient,
    handleAddReport,
    handleExportPatients,
    handleImportPatients,
    handleSaveTranscription,
  };
}
