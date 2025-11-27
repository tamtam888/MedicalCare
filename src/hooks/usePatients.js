// src/hooks/usePatients.js
import { useEffect, useState } from "react";
import { medplum } from "../medplumClient";

const STORAGE_KEY = "patients";
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

/** Check Medplum session */
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

/** FHIR mappers */
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
  const [patients, setPatients] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];
      const parsed = JSON.parse(stored);
      return parsed.map(normalizePatient);
    } catch (error) {
      console.error("Failed to parse patients from localStorage", error);
      return [];
    }
  });

  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatientIdNumber, setSelectedPatientIdNumber] =
    useState(null);

  // persist to localStorage on every change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    } catch (error) {
      console.error("Failed to save patients to localStorage", error);
    }
  }, [patients]);

  const selectedPatient =
    patients.find((p) => p.idNumber === selectedPatientIdNumber) || null;

  const selectedPatientFullName = selectedPatient
    ? [selectedPatient.firstName, selectedPatient.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  // create
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

    // add locally
    setPatients((prev) => [...prev, newPatient]);
    setSelectedPatientIdNumber(idNumber);
    setEditingPatient(null);

    // sync to Medplum
    if (hasMedplumSession()) {
      try {
        const fhirPatient = toFhirPatient(newPatient);
        console.log("handleCreatePatient - FHIR payload:", fhirPatient);
        const created = await medplum.createResource(fhirPatient);
        console.log("Patient created in Medplum:", created);

        if (created && created.id) {
          const medplumId = created.id;
          setPatients((prev) =>
            prev.map((p) =>
              trimId(p.idNumber) === idNumber
                ? { ...p, medplumId }
                : p
            )
          );
        }
      } catch (error) {
        console.error("Failed to create patient in Medplum", error);
      }
    }
  };

  // update
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
        if (p.idNumber !== editingPatient.idNumber) return p;

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

    if (hasMedplumSession() && updatedPatientRef) {
      try {
        const baseFhir = toFhirPatient(updatedPatientRef);

        if (updatedPatientRef.medplumId) {
          const updatedFhir = {
            ...baseFhir,
            id: updatedPatientRef.medplumId,
          };
          const saved = await medplum.updateResource(updatedFhir);
          console.log("Patient updated in Medplum:", saved);
        } else {
          const searchBundle = await medplum.search("Patient", {
            identifier: `${ID_SYSTEM}|${newIdNumber}`,
          });
          const existingResource =
            searchBundle.entry?.[0]?.resource || null;

          if (existingResource) {
            const updatedFhir = {
              ...existingResource,
              ...baseFhir,
              id: existingResource.id,
            };
            const saved = await medplum.updateResource(updatedFhir);
            console.log(
              "Patient updated in Medplum (found by identifier):",
              saved
            );

            if (saved && saved.id) {
              const medplumId = saved.id;
              setPatients((prev) =>
                prev.map((p) =>
                  trimId(p.idNumber) === newIdNumber
                    ? { ...p, medplumId }
                    : p
                )
              );
            }
          } else {
            const created = await medplum.createResource(baseFhir);
            console.log(
              "Patient not found in Medplum, created new:",
              created
            );
            if (created && created.id) {
              const medplumId = created.id;
              setPatients((prev) =>
                prev.map((p) =>
                  trimId(p.idNumber) === newIdNumber
                    ? { ...p, medplumId }
                    : p
                )
              );
            }
          }
        }
      } catch (error) {
        console.error("Failed to update patient in Medplum", error);
      }
    }
  };

  const handleCancelEdit = () => setEditingPatient(null);

  const handleEditPatient = (idNumber) => {
    if (!idNumber) {
      setEditingPatient(null);
      return;
    }
    const patient = patients.find((p) => p.idNumber === idNumber);
    if (!patient) return;

    setEditingPatient(patient);
    setSelectedPatientIdNumber(idNumber);
  };

  // delete - also deletes from Medplum when possible
  const handleDeletePatient = async (idNumber) => {
    const id = trimId(idNumber);
    if (!id) return;

    const patient = patients.find(
      (p) => trimId(p.idNumber) === id
    );

    if (hasMedplumSession() && patient && patient.medplumId) {
      try {
        await medplum.deleteResource("Patient", patient.medplumId);
      } catch (error) {
        console.error("Failed to delete patient in Medplum", error);
        alert("Failed to delete patient from Medplum. Please try again.");
        return;
      }
    }

    setPatients((prev) => prev.filter((p) => trimId(p.idNumber) !== id));

    if (selectedPatientIdNumber === id) {
      setSelectedPatientIdNumber(null);
    }

    if (editingPatient && trimId(editingPatient.idNumber) === id) {
      setEditingPatient(null);
    }
  };

  const handleSelectPatient = (idNumber) => {
    setSelectedPatientIdNumber(idNumber);
  };

  const handleAddReport = (idNumber, reportMeta) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.idNumber !== idNumber) return p;

        const reports = [...ensureArray(p.reports), reportMeta];

        const historyEntry = {
          id: reportMeta.id,
          type: "Report",
          title: `Report attached: ${reportMeta.name}`,
          date: reportMeta.uploadedAt,
          summary: "PDF report was attached to the patient profile.",
        };

        const history = [...ensureArray(p.history), historyEntry];

        return { ...p, reports, history };
      })
    );
  };

  const handleExportPatients = () => {
    if (!patients.length) {
      alert("No patients to export.");
      return;
    }

    const fhirBundle = {
      resourceType: "Bundle",
      type: "collection",
      entry: patients.map((p) => ({
        resource: toFhirPatient(p),
      })),
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

  const handleImportPatients = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target.result);

        if (json.resourceType !== "Bundle" || !Array.isArray(json.entry)) {
          alert("Invalid FHIR JSON file.");
          return;
        }

        const importedResources = json.entry
          .map((entry) => entry.resource)
          .filter((res) => res && res.resourceType === "Patient");

        if (!importedResources.length) {
          alert("No Patient resources found in file.");
          return;
        }

        const importedPatients = importedResources.map(fromFhirPatient);

        setPatients((prev) => {
          const map = new Map(
            prev.map((p) => [trimId(p.idNumber), normalizePatient(p)])
          );

          importedPatients.forEach((imp) => {
            const key = trimId(imp.idNumber);
            if (!key) return;

            if (map.has(key)) {
              const existing = map.get(key);
              map.set(key, {
                ...existing,
                ...imp,
                history: existing.history,
                reports: existing.reports,
              });
            } else {
              map.set(key, imp);
            }
          });

          return Array.from(map.values());
        });

        alert("Patients imported successfully.");
      } catch (error) {
        console.error("Failed to import patients", error);
        alert("Failed to read JSON file.");
      }
    };

    reader.readAsText(file);
  };

  const handleSaveTranscription = (idNumber, transcriptionText) => {
    if (!idNumber || !transcriptionText || !transcriptionText.trim()) {
      return;
    }

    const cleanText = transcriptionText.trim();
    const now = new Date().toISOString();

    setPatients((prev) =>
      prev.map((p) => {
        if (p.idNumber !== idNumber) return p;

        const history = [...ensureArray(p.history)];

        let lastIndex = -1;
        for (let i = history.length - 1; i >= 0; i -= 1) {
          if (history[i].type === "Transcription") {
            lastIndex = i;
            break;
          }
        }

        if (lastIndex === -1) {
          history.push({
            id: crypto.randomUUID(),
            type: "Transcription",
            title: "Treatment transcription",
            date: now,
            summary: cleanText,
          });
        } else {
          const previous = history[lastIndex];
          history[lastIndex] = {
            ...previous,
            date: now,
            summary: cleanText,
          };
        }

        return {
          ...p,
          history,
        };
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
