// src/hooks/usePatients.js - FIXED MEDIA VERSION
import { useEffect, useState, useRef } from "react";
import {
  ensureArray,
  trimId,
  normalizePatient,
  toFhirPatient,
  fromFhirPatient,
  historyItemToObservation,
  reportToDiagnosticReport,
  hasMedplumSession,
  ID_SYSTEM,
} from "../utils/patientFhir";
import { medplum } from "../medplumClient";

const STORAGE_KEY = "patients";

function parseStorageData(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function loadPatientsFromLocalStorage() {
  if (typeof window === "undefined") {
    if (import.meta.env.DEV) {
      console.warn("[usePatients] window is undefined, cannot load from localStorage");
    }
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = parseStorageData(raw);
    if (parsed && Array.isArray(parsed) && parsed.length > 0) {
      if (import.meta.env.DEV) {
        console.log(`[usePatients] ✅ Loaded ${parsed.length} patients from localStorage`);
      }
      return parsed.map(normalizePatient);
    }

    const backupRaw = window.localStorage.getItem(`${STORAGE_KEY}_backup`);
    const backupParsed = parseStorageData(backupRaw);
    if (backupParsed && Array.isArray(backupParsed) && backupParsed.length > 0) {
      if (import.meta.env.DEV) {
        console.log(
          `[usePatients] ✅ Loaded ${backupParsed.length} patients from backup`
        );
      }
      return backupParsed.map(normalizePatient);
    }

    if (import.meta.env.DEV) {
      console.log("[usePatients] No patients found in localStorage");
    }
    return [];
  } catch (error) {
    console.error("[usePatients] ❌ Failed to load patients:", error);
    try {
      const backupRaw = window.localStorage.getItem(`${STORAGE_KEY}_backup`);
      const backupParsed = parseStorageData(backupRaw);
      if (backupParsed && Array.isArray(backupParsed)) {
        if (import.meta.env.DEV) {
          console.log(
            `[usePatients] ✅ Recovered ${backupParsed.length} patients from backup`
          );
        }
        return backupParsed.map(normalizePatient);
      }
    } catch (backupError) {
      console.error("[usePatients] ❌ Failed to recover from backup:", backupError);
    }
    return [];
  }
}

function savePatientsToLocalStorage(patients) {
  if (typeof window === "undefined") {
    if (import.meta.env.DEV) {
      console.warn("[usePatients] window is undefined, cannot save");
    }
    return;
  }

  const safe = Array.isArray(patients) ? patients.map(normalizePatient) : [];
  const json = JSON.stringify(safe);

  try {
    window.localStorage.setItem(STORAGE_KEY, json);
    window.localStorage.setItem(`${STORAGE_KEY}_backup`, json);
    if (import.meta.env.DEV) {
      console.log(
        `[usePatients] ✅ Saved ${safe.length} patients (main + backup)`
      );
    }
  } catch (error) {
    console.error("[usePatients] ❌ Failed to save:", error);
    try {
      window.localStorage.setItem(`${STORAGE_KEY}_backup`, json);
      if (import.meta.env.DEV) {
        console.log("[usePatients] ⚠️ Saved to backup only");
      }
    } catch (backupError) {
      console.error("[usePatients] ❌ Failed to save backup:", backupError);
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.setItem(STORAGE_KEY, json);
        if (import.meta.env.DEV) {
          console.log("[usePatients] ✅ Recovered: saved after cleanup");
        }
      } catch (finalError) {
        console.error("[usePatients] ❌ All save attempts failed:", finalError);
        alert(
          "⚠️ Failed to save patient data. Your data may be lost if you refresh!"
        );
      }
    }
  }
}

/**
 * Convert audioData (data URL or raw base64) to attachment fields.
 * Returns { contentType, data } or null if invalid.
 */
function extractAudioAttachment(audioData) {
  if (!audioData) return null;

  const value = String(audioData);
  if (import.meta.env.DEV) {
    console.log(
      "[extractAudioAttachment] raw length:",
      value.length,
      "preview:",
      value.slice(0, 40)
    );
  }

  // data URL case: "data:audio/webm;codecs=opus;base64,AAAA..."
  if (value.startsWith("data:")) {
    const parts = value.split(",");
    if (parts.length < 2) {
      if (import.meta.env.DEV) {
        console.warn("[extractAudioAttachment] Invalid data URL - missing comma");
      }
      return null;
    }
    const meta = parts[0]; // "data:audio/webm;codecs=opus;base64"
    const base64 = parts[1]; // pure base64

    const metaAfterPrefix = meta.split(":")[1] || "";
    const contentType = metaAfterPrefix.split(";")[0] || "audio/webm";

    if (!base64) {
      if (import.meta.env.DEV) {
        console.warn("[extractAudioAttachment] Empty base64 part");
      }
      return null;
    }

    return { contentType, data: base64 };
  }

  // Fallback: assume we already have pure base64 without prefix
  return {
    contentType: "audio/webm",
    data: value,
  };
}

async function ensureMedplumPatient(patient) {
  if (!hasMedplumSession()) {
    if (import.meta.env.DEV) {
      console.warn("[ensureMedplumPatient] No Medplum session");
    }
    return null;
  }

  const idNumber = trimId(patient.idNumber);
  if (!idNumber) {
    if (import.meta.env.DEV) {
      console.warn("[ensureMedplumPatient] No ID number");
    }
    return null;
  }

  if (patient.medplumId) {
    if (import.meta.env.DEV) {
      console.log(
        `[ensureMedplumPatient] ✅ Using existing medplumId: ${patient.medplumId}`
      );
    }
    return patient.medplumId;
  }

  try {
    const searchBundle = await medplum.search("Patient", {
      identifier: `${ID_SYSTEM}|${idNumber}`,
    });
    const existing = searchBundle.entry?.[0]?.resource;

    const baseFhir = toFhirPatient(patient);

    if (existing?.id) {
      if (import.meta.env.DEV) {
        console.log(
          `[ensureMedplumPatient] ✅ Found existing patient: ${existing.id}`
        );
      }
      try {
        const updated = await medplum.updateResource({
          ...existing,
          ...baseFhir,
          id: existing.id,
        });
        return updated?.id || existing.id;
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error(
            "[ensureMedplumPatient] ⚠️ Update failed, using existing ID:",
            error
          );
        }
        return existing.id;
      }
    }

    if (import.meta.env.DEV) {
      console.log("[ensureMedplumPatient] Creating new patient in Medplum...");
    }
    try {
      const created = await medplum.createResource(baseFhir);
      if (import.meta.env.DEV) {
        console.log(
          `[ensureMedplumPatient] ✅ Created new patient: ${created.id}`
        );
      }
      return created?.id || null;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[ensureMedplumPatient] ❌ Failed to create:", error);
      }
      return null;
    }
  } catch (error) {
    if (import.meta.env.DEV) {
      console.error("[ensureMedplumPatient] ❌ Search failed:", error);
    }
    return null;
  }
}

export function usePatients() {
  const [patients, setPatients] = useState(() => {
    const loaded = loadPatientsFromLocalStorage();
    if (import.meta.env.DEV && loaded.length > 0) {
      console.log(`[usePatients] 🚀 Initialized with ${loaded.length} patients`);
    }
    return loaded;
  });
  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatientIdNumber, setSelectedPatientIdNumber] = useState(null);

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    savePatientsToLocalStorage(patients);
  }, [patients]);

  useEffect(() => {
    let cancelled = false;

    const syncFromMedplum = async () => {
      if (cancelled) return;
      if (patients.length > 0) return;
      if (!hasMedplumSession()) return;

      try {
        if (import.meta.env.DEV) {
          console.log(
            "[syncFromMedplum] 🔄 Starting initial sync from Medplum..."
          );
        }
        const bundle = await medplum.search("Patient", { _count: 100 });
        const resources = Array.isArray(bundle.entry)
          ? bundle.entry
              .map((e) => e.resource)
              .filter((r) => r && r.resourceType === "Patient")
          : [];
        const imported = resources.map(fromFhirPatient);

        if (!cancelled && imported.length > 0) {
          if (import.meta.env.DEV) {
            console.log(
              `[syncFromMedplum] ✅ Imported ${imported.length} patients from Medplum`
            );
          }
          setPatients((prev) =>
            prev.length > 0 ? prev : imported.map(normalizePatient)
          );
        } else if (!cancelled && imported.length === 0) {
          if (import.meta.env.DEV) {
            console.log("[syncFromMedplum] No patients found in Medplum");
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("[syncFromMedplum] ❌ Failed to sync:", error);
        }
      }
    };

    syncFromMedplum();

    return () => {
      cancelled = true;
    };
  }, [patients.length]);

  const findPatientById = (idNumber) =>
    patients.find((p) => trimId(p.idNumber) === trimId(idNumber)) || null;

  const selectedPatient = findPatientById(selectedPatientIdNumber);
  const selectedPatientFullName = selectedPatient
    ? [selectedPatient.firstName, selectedPatient.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  const updatePatientsWithSave = (updater) => {
    setPatients((prev) => {
      const updated = typeof updater === "function" ? updater(prev) : updater;
      savePatientsToLocalStorage(updated);
      return updated;
    });
  };

  const syncToMedplum = async (patient, errorContext = "patient") => {
    if (!hasMedplumSession()) {
      if (import.meta.env.DEV) {
        console.warn(
          `[syncToMedplum] ⚠️ No session, skipping sync for ${errorContext}`
        );
      }
      return;
    }
    try {
      await createOrUpdateMedplumPatient(patient);
      if (import.meta.env.DEV) {
        console.log(
          `[syncToMedplum] ✅ Successfully synced ${errorContext}`
        );
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          `[syncToMedplum] ❌ Failed to sync ${errorContext}:`,
          error
        );
      }
      alert(
        `⚠️ Failed to sync ${errorContext} to Medplum. Check your connection.`
      );
    }
  };

  async function createOrUpdateMedplumPatient(updatedPatient) {
    if (!hasMedplumSession()) {
      if (import.meta.env.DEV) {
        console.warn("[createOrUpdateMedplumPatient] No Medplum session");
      }
      return;
    }
    try {
      const medplumId = await ensureMedplumPatient(updatedPatient);
      if (!medplumId) {
        if (import.meta.env.DEV) {
          console.warn(
            "[createOrUpdateMedplumPatient] ⚠️ No medplumId returned"
          );
        }
        return;
      }
      updatePatientsWithSave((prev) =>
        prev.map((p) =>
          trimId(p.idNumber) === trimId(updatedPatient.idNumber)
            ? { ...p, medplumId }
            : p
        )
      );
      if (import.meta.env.DEV) {
        console.log(
          `[createOrUpdateMedplumPatient] ✅ Patient has medplumId: ${medplumId}`
        );
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("[createOrUpdateMedplumPatient] ❌ Error:", error);
      }
      throw error;
    }
  }

  const patientIdExists = (idNumber) =>
    patients.some((p) => trimId(p.idNumber) === trimId(idNumber));

  const handleCreatePatient = async (formData) => {
    const idNumber = trimId(formData.idNumber);
    if (!idNumber) {
      alert("ID number is required.");
      return;
    }

    if (patientIdExists(idNumber)) {
      alert("A patient with this ID number already exists.");
      return;
    }

    const newPatient = normalizePatient({
      ...formData,
      idNumber,
      history: [
        {
          id: crypto.randomUUID(),
          type: "note",
          title: "Patient profile created",
          date: new Date().toISOString(),
          summary: "Initial patient profile was created in the system.",
          audioData: null,
        },
      ],
      reports: [],
    });

    updatePatientsWithSave((prev) => [...prev, newPatient]);
    setSelectedPatientIdNumber(idNumber);
    setEditingPatient(null);

    if (import.meta.env.DEV) {
      console.log(
        "[handleCreatePatient] ✅ Patient created locally, syncing to Medplum..."
      );
    }
    syncToMedplum(newPatient, "new patient");
  };

  const handleUpdatePatient = async (updatedData) => {
    if (!editingPatient) return;

    const newIdNumber = trimId(updatedData.idNumber);
    const oldIdNumber = trimId(editingPatient.idNumber);

    if (!newIdNumber) {
      alert("ID number is required.");
      return;
    }

    if (newIdNumber !== oldIdNumber && patientIdExists(newIdNumber)) {
      alert("Another patient already uses this ID number.");
      return;
    }

    let updatedPatientRef = null;
    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== oldIdNumber) return p;
        updatedPatientRef = normalizePatient({
          ...p,
          ...updatedData,
          idNumber: newIdNumber,
        });
        return updatedPatientRef;
      })
    );

    setEditingPatient(null);
    setSelectedPatientIdNumber(newIdNumber);

    if (import.meta.env.DEV) {
      console.log(
        "[handleUpdatePatient] ✅ Patient updated locally, syncing to Medplum..."
      );
    }
    if (updatedPatientRef) syncToMedplum(updatedPatientRef, "updated patient");
  };

  const handleUpdatePatientInline = async (updatedPatient) => {
    if (!updatedPatient) return;

    const idNumber = trimId(updatedPatient.idNumber);
    if (!idNumber) {
      if (import.meta.env.DEV) {
        console.warn("handleUpdatePatientInline: missing idNumber");
      }
      return;
    }

    let updatedPatientRef = null;
    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== idNumber) return p;
        updatedPatientRef = normalizePatient({
          ...p,
          ...updatedPatient,
          idNumber,
        });
        return updatedPatientRef;
      })
    );

    setSelectedPatientIdNumber(idNumber);
    if (updatedPatientRef)
      syncToMedplum(updatedPatientRef, "inline updated patient");
  };

  const handleCancelEdit = () => setEditingPatient(null);

  const handleEditPatient = (idNumber) => {
    const patient = findPatientById(idNumber);
    if (!patient) return;
    setEditingPatient(patient);
    setSelectedPatientIdNumber(idNumber);
  };

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
          const existing = searchBundle.entry?.[0]?.resource;
          if (existing?.id) targetId = existing.id;
        }

        if (targetId) {
          await medplum.deleteResource("Patient", targetId);
          if (import.meta.env.DEV) {
            console.log(
              `[handleDeletePatient] ✅ Deleted from Medplum: ${targetId}`
            );
          }
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error(
            "[handleDeletePatient] ❌ Failed to delete from Medplum:",
            error
          );
        }
        alert("Failed to delete patient from Medplum.");
        return;
      }
    }

    updatePatientsWithSave((prev) =>
      prev.filter((p) => trimId(p.idNumber) !== id)
    );

    if (trimId(selectedPatientIdNumber) === id) {
      setSelectedPatientIdNumber(null);
    }

    if (editingPatient && trimId(editingPatient.idNumber) === id) {
      setEditingPatient(null);
    }

    if (import.meta.env.DEV) {
      console.log(`[handleDeletePatient] ✅ Patient deleted: ${id}`);
    }
  };

  const handleSelectPatient = (idNumber) => {
    setSelectedPatientIdNumber(idNumber);
  };

  const handleAddReport = (idNumber, reportMeta) => {
    const trimmedId = trimId(idNumber);
    if (!trimmedId) {
      if (import.meta.env.DEV) {
        console.warn("[handleAddReport] No ID number provided");
      }
      return;
    }

    let updatedPatientRef = null;
    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimmedId) return p;
        updatedPatientRef = {
          ...p,
          reports: [...ensureArray(p.reports), reportMeta],
          history: [
            ...ensureArray(p.history),
            {
              id: reportMeta.id || crypto.randomUUID(),
              type: "report",
              title: `Report attached: ${reportMeta.name}`,
              date: reportMeta.uploadedAt,
              summary: "PDF report was attached to the patient profile.",
              audioData: null,
            },
          ],
        };
        return updatedPatientRef;
      })
    );

    if (import.meta.env.DEV) {
      console.log("[handleAddReport] ✅ Report added locally");
    }

    if (updatedPatientRef && hasMedplumSession()) {
      syncToMedplum(updatedPatientRef, "report attachment");
    }
  };

  const handleDeleteReport = (idNumber, reportId) => {
    const trimmedId = trimId(idNumber);
    if (!trimmedId || !reportId) {
      if (import.meta.env.DEV) {
        console.warn("[handleDeleteReport] Missing ID number or report ID");
      }
      return;
    }

    let updatedPatientRef = null;
    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimmedId) return p;
        updatedPatientRef = {
          ...p,
          reports: ensureArray(p.reports).filter((r) => r.id !== reportId),
        };
        return updatedPatientRef;
      })
    );

    if (import.meta.env.DEV) {
      console.log("[handleDeleteReport] ✅ Report deleted locally");
    }

    if (updatedPatientRef && hasMedplumSession()) {
      syncToMedplum(updatedPatientRef, "report deletion");
    }
  };

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
    link.download = `patients-export-${
      new Date().toISOString().split("T")[0]
    }.json`;
    link.click();
    URL.revokeObjectURL(url);

    if (import.meta.env.DEV) {
      console.log("[handleExportPatients] ✅ Exported FHIR bundle");
    }
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

        const resources = json.entry.map((entry) => entry.resource).filter(Boolean);

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

          let audioData = null;
          if (Array.isArray(obs.extension)) {
            const audioExt = obs.extension.find(
              (ext) =>
                ext.url === "https://medicalcare.local/extension/audioData"
            );
            if (audioExt && typeof audioExt.valueString === "string") {
              audioData = audioExt.valueString;
            }
          }

          const list = historyByIdNumber.get(idNumber) || [];
          list.push({
            id: obs.id || crypto.randomUUID(),
            type: "transcription",
            title: obs.code?.text || "History item",
            date: obs.effectiveDateTime || "",
            summary:
              Array.isArray(obs.note) && obs.note[0]?.text
                ? obs.note[0].text
                : obs.valueString || "",
            audioData,
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

            const importedHistory = historyByIdNumber.get(key) || [];
            const importedReports = reportsByIdNumber.get(key) || [];

            if (map.has(key)) {
              const existing = map.get(key);

              const mergedHistory = [
                ...ensureArray(existing.history),
                ...importedHistory,
              ];
              const mergedReports = [
                ...ensureArray(existing.reports),
                ...importedReports,
              ];

              const uniqueHistory = [];
              const seenHistoryIds = new Set();

              mergedHistory.forEach((item) => {
                const id =
                  item.id || `${item.date || ""}-${item.title || ""}`;
                if (seenHistoryIds.has(id)) return;
                seenHistoryIds.add(id);
                uniqueHistory.push(item);
              });

              const uniqueReports = [];
              const seenReportIds = new Set();

              mergedReports.forEach((report) => {
                const id =
                  report.id || `${report.date || ""}-${report.name || ""}`;
                if (seenReportIds.has(id)) return;
                seenReportIds.add(id);
                uniqueReports.push(report);
              });

              map.set(
                key,
                normalizePatient({
                  ...existing,
                  ...imp,
                  history: uniqueHistory,
                  reports: uniqueReports,
                })
              );
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

          return Array.from(map.values()).map(normalizePatient);
        });

        if (import.meta.env.DEV) {
          console.log("[handleImportPatients] ✅ Patients imported successfully");
        }
        alert("✅ Patients imported successfully!");
      } catch (error) {
        console.error("[handleImportPatients] ❌ Failed to import:", error);
        alert("❌ Import failed. Check console for details.");
      }
    };

    reader.readAsText(file);
  };

  const handleSaveTranscription = async (
    idNumber,
    transcriptionText,
    audioData
  ) => {
    const trimmedId = trimId(idNumber);
    const cleanText = (transcriptionText || "").trim();
    const cleanAudio = audioData || null;

    if (!trimmedId) {
      if (import.meta.env.DEV) {
        console.warn("[handleSaveTranscription] ⚠️ No ID number provided");
      }
      return;
    }
    if (!cleanText && !cleanAudio) {
      if (import.meta.env.DEV) {
        console.warn("[handleSaveTranscription] ⚠️ No text or audio provided");
      }
      return;
    }

    const now = new Date().toISOString();
    let updatedPatientRef = null;
    let newHistoryItemRef = null;

    // Step 1 - local save
    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimmedId) return p;

        const historyItem = {
          id: crypto.randomUUID(),
          type: "transcription",
          title: "Treatment transcription",
          date: now,
          summary: cleanText || "Audio recording",
          audioData: cleanAudio,
        };

        newHistoryItemRef = historyItem;
        updatedPatientRef = {
          ...p,
          history: [...ensureArray(p.history), historyItem],
        };
        return updatedPatientRef;
      })
    );

    if (import.meta.env.DEV) {
      console.log("[handleSaveTranscription] ✅ Step 1: Saved to localStorage");
    }

    // No Medplum session - local only
    if (!hasMedplumSession()) {
      if (import.meta.env.DEV) {
        console.log(
          "[handleSaveTranscription] ⚠️ No Medplum session, saved locally only"
        );
      }
      alert("✅ Transcription saved locally (no Medplum connection)");
      return;
    }

    if (!updatedPatientRef || !newHistoryItemRef) {
      if (import.meta.env.DEV) {
        console.warn(
          "[handleSaveTranscription] ⚠️ No patient or history item to sync"
        );
      }
      return;
    }

    // Background sync
    (async () => {
      try {
        if (import.meta.env.DEV) {
          console.log(
            "[handleSaveTranscription] Step 2: Syncing to Medplum..."
          );
        }

        const medplumId = await ensureMedplumPatient(updatedPatientRef);

        if (!medplumId) {
          if (import.meta.env.DEV) {
            console.warn(
              "[handleSaveTranscription] ⚠️ Failed to get medplumId"
            );
          }
          return;
        }

        if (!updatedPatientRef.medplumId) {
          updatePatientsWithSave((prev) =>
            prev.map((p) =>
              trimId(p.idNumber) === trimmedId ? { ...p, medplumId } : p
            )
          );
          updatedPatientRef = { ...updatedPatientRef, medplumId };
        }

        const subjectRef = `Patient/${medplumId}`;

        // 2B - Observation with text
        const observation = {
          resourceType: "Observation",
          status: "final",
          subject: { reference: subjectRef },
          effectiveDateTime: now,
          code: {
            text: newHistoryItemRef.title || "Treatment transcription",
          },
          note: cleanText ? [{ text: cleanText }] : [],
        };

        const audioExtension = extractAudioAttachment(cleanAudio);
        if (audioExtension) {
          observation.extension = [
            {
              url: "https://medicalcare.local/extension/audioData",
              valueString: cleanAudio,
            },
          ];
        }

        const createdObservation = await medplum.createResource(observation);

        if (import.meta.env.DEV) {
          console.log(
            `[handleSaveTranscription] ✅ Step 2B: Created Observation: ${createdObservation.id}`
          );
        }

        // 2C - Media with audio
        if (cleanAudio) {
          try {
            const attachment = extractAudioAttachment(cleanAudio);
            if (!attachment) {
              if (import.meta.env.DEV) {
                console.warn(
                  "[handleSaveTranscription] ⚠️ Could not extract audio attachment for Media"
                );
              }
            } else {
              const media = {
                resourceType: "Media",
                status: "completed",
                subject: { reference: subjectRef },
                createdDateTime: now,
                type: {
                  text: "Audio recording",
                },
                content: {
                  contentType: attachment.contentType,
                  data: attachment.data,
                  title: "Treatment Audio Recording",
                },
              };

              const createdMedia = await medplum.createResource(media);

              if (import.meta.env.DEV) {
                console.log(
                  `[handleSaveTranscription] ✅ Step 2C: Created Media: ${createdMedia.id}`
                );
              }
            }
          } catch (mediaError) {
            if (import.meta.env.DEV) {
              console.error(
                "[handleSaveTranscription] ⚠️ Failed to create Media (audio):",
                mediaError
              );
            }
          }
        }

        if (import.meta.env.DEV) {
          console.log(
            "[handleSaveTranscription] ✅✅✅ FULL SYNC COMPLETED SUCCESSFULLY!"
          );
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error(
            "[handleSaveTranscription] ❌ Medplum sync failed:",
            error
          );
        }
      }
    })();

    alert("✅ Transcription saved successfully!");
  };

  const handleSyncAllToMedplum = async () => {
    if (!hasMedplumSession()) {
      alert("⚠️ Not connected to Medplum. Please sign in first.");
      return;
    }

    const confirmSync = confirm(
      `🔄 This will sync ${patients.length} patients and all their data to Medplum.\n\nThis includes:\n• Patient demographics\n• All transcriptions\n• All audio recordings\n• All reports\n\nContinue?`
    );

    if (!confirmSync) return;

    try {
      if (import.meta.env.DEV) {
        console.log(
          "[handleSyncAllToMedplum] 🚀🚀🚀 STARTING FULL SYNC..."
        );
      }

      alert("🔄 Starting full sync... This may take a few minutes.");

      const updatedPatients = [...patients];
      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < updatedPatients.length; i++) {
        const p = updatedPatients[i];
        const idNumber = trimId(p.idNumber);
        if (!idNumber) continue;

        try {
          if (import.meta.env.DEV) {
            console.log(
              `[handleSyncAllToMedplum] Processing ${i + 1}/${
                updatedPatients.length
              }: ${p.firstName} ${p.lastName}`
            );
          }

          let medplumId = p.medplumId || null;

          try {
            medplumId =
              (await ensureMedplumPatient(
                medplumId ? p : { ...p, medplumId: null }
              )) || medplumId;
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn(
                `[handleSyncAllToMedplum] ⚠️ Failed to ensure patient ${idNumber}:`,
                error
              );
            }
            errorCount++;
            errors.push(
              `${p.firstName} ${p.lastName}: ${error.message}`
            );
            continue;
          }

          if (!medplumId) {
            if (import.meta.env.DEV) {
              console.warn(
                `[handleSyncAllToMedplum] ⚠️ No medplumId for ${idNumber}`
              );
            }
            errorCount++;
            errors.push(
              `${p.firstName} ${p.lastName}: Could not get Medplum ID`
            );
            continue;
          }

          updatedPatients[i] = { ...p, medplumId };
          const subjectRef = `Patient/${medplumId}`;

          const history = ensureArray(updatedPatients[i].history);
          if (import.meta.env.DEV) {
            console.log(
              `[handleSyncAllToMedplum]   Syncing ${history.length} history items...`
            );
          }

          for (let j = 0; j < history.length; j++) {
            const item = history[j];

            try {
              const baseObservation = historyItemToObservation(
                { ...updatedPatients[i], medplumId },
                item,
                j
              );
              baseObservation.subject = { reference: subjectRef };

              await medplum.createResource(baseObservation);

              if (item.audioData) {
                const attachment = extractAudioAttachment(item.audioData);
                if (attachment) {
                  const media = {
                    resourceType: "Media",
                    status: "completed",
                    subject: { reference: subjectRef },
                    createdDateTime:
                      item.date || new Date().toISOString(),
                    type: {
                      text: "Audio recording",
                    },
                    content: {
                      contentType: attachment.contentType,
                      data: attachment.data,
                      title: item.title || "Audio Recording",
                    },
                  };

                  await medplum.createResource(media);

                  if (import.meta.env.DEV) {
                    console.log(
                      `[handleSyncAllToMedplum]     ✅ Audio synced for history item ${
                        j + 1
                      }`
                    );
                  }
                } else if (import.meta.env.DEV) {
                  console.warn(
                    `[handleSyncAllToMedplum]     ⚠️ Could not extract attachment for history item ${
                      j + 1
                    }`
                  );
                }
              }
            } catch (historyError) {
              if (import.meta.env.DEV) {
                console.warn(
                  `[handleSyncAllToMedplum]     ⚠️ Failed history item ${
                    j + 1
                  }:`,
                  historyError
                );
              }
            }
          }

          const reports = ensureArray(updatedPatients[i].reports);
          if (import.meta.env.DEV && reports.length > 0) {
            console.log(
              `[handleSyncAllToMedplum]   Syncing ${reports.length} reports...`
            );
          }

          for (let k = 0; k < reports.length; k++) {
            const report = reports[k];

            try {
              const diagnostic = reportToDiagnosticReport(
                { ...updatedPatients[i], medplumId },
                report,
                k
              );

              diagnostic.subject = { reference: subjectRef };

              await medplum.createResource(diagnostic);

              if (import.meta.env.DEV) {
                console.log(
                  `[handleSyncAllToMedplum]     ✅ Report ${k + 1} synced`
                );
              }
            } catch (reportError) {
              if (import.meta.env.DEV) {
                console.warn(
                  `[handleSyncAllToMedplum]     ⚠️ Failed report ${
                    k + 1
                  }:`,
                  reportError
                );
              }
            }
          }

          successCount++;
          if (import.meta.env.DEV) {
            console.log(
              `[handleSyncAllToMedplum] ✅ Patient ${i + 1}/${
                updatedPatients.length
              } synced`
            );
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error(
              `[handleSyncAllToMedplum] ❌ Error syncing patient ${idNumber}:`,
              error
            );
          }
          errorCount++;
          errors.push(
            `${p.firstName} ${p.lastName}: ${error.message}`
          );
        }
      }

      setPatients(updatedPatients);

      if (import.meta.env.DEV) {
        console.log(
          `[handleSyncAllToMedplum] 🏁 SYNC COMPLETED: ${successCount} succeeded, ${errorCount} failed`
        );
        if (errors.length > 0) {
          console.error("[handleSyncAllToMedplum] Errors:", errors);
        }
      }

      let message = `✅ Full sync completed!\n\n`;
      message += `✅ ${successCount} patients synced successfully\n`;
      if (errorCount > 0) {
        message += `⚠️ ${errorCount} patients failed\n\n`;
        message += `Check console for details.`;
      } else {
        message += `\n🎉 All data is now in Medplum!`;
      }

      alert(message);
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error(
          "[handleSyncAllToMedplum] ❌ FULL SYNC FAILED:",
          error
        );
      }
      alert(
        "❌ Full sync to Medplum failed. Check console for details."
      );
    }
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
    handleDeleteReport,
    handleExportPatients,
    handleImportPatients,
    handleSaveTranscription,
    handleSyncAllToMedplum,
  };
}
