// src/hooks/usePatients.js
import { useEffect, useRef, useState } from "react";
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
} from "../utils/fhirPatient.js";
import { medplum } from "../medplumClient";

const STORAGE_KEY = "patients";

/**
 * IndexedDB settings
 */
const DB_NAME = "medicalcare_local";
const DB_VERSION = 1;
const STORE_KV = "kv";
const KV_PATIENTS = "patients_v1";

/**
 * Stable identifier system for de-duplication
 * (Observations / DiagnosticReports / Media created by this app)
 */
const APP_IDENTIFIER_SYSTEM = "https://medicalcare.app/identifiers";

const normalizePatientPreserve = (patient) => {
  const base = normalizePatient(patient);
  return {
    ...base,
    history: ensureArray(patient?.history ?? base?.history),
    reports: ensureArray(patient?.reports ?? base?.reports),
  };
};

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
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = parseStorageData(raw);
    if (parsed && parsed.length > 0) return parsed.map(normalizePatientPreserve);

    const backupRaw = window.localStorage.getItem(`${STORAGE_KEY}_backup`);
    const backupParsed = parseStorageData(backupRaw);
    if (backupParsed && backupParsed.length > 0) {
      return backupParsed.map(normalizePatientPreserve);
    }

    return [];
  } catch {
    try {
      const backupRaw = window.localStorage.getItem(`${STORAGE_KEY}_backup`);
      const backupParsed = parseStorageData(backupRaw);
      if (backupParsed && Array.isArray(backupParsed)) {
        return backupParsed.map(normalizePatientPreserve);
      }
    } catch {}
    return [];
  }
}

function safeWriteLocalBackup(patients) {
  if (typeof window === "undefined") return;

  const safe = Array.isArray(patients) ? patients.map(normalizePatientPreserve) : [];
  let json = "[]";
  try {
    json = JSON.stringify(safe);
  } catch {
    return;
  }

  // Best-effort backup only. Avoid quota issues.
  // If it fails, we still have IndexedDB as source of truth.
  try {
    window.localStorage.setItem(`${STORAGE_KEY}_backup`, json);
  } catch {
    // ignore
  }
}

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    const req = window.indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("Failed to open IndexedDB"));
  });
}

function idbGet(key) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_KV, "readonly");
        const store = tx.objectStore(STORE_KV);
        const req = store.get(key);

        req.onsuccess = () => resolve(req.result ?? null);
        req.onerror = () => reject(req.error || new Error("IndexedDB get failed"));

        tx.oncomplete = () => db.close();
        tx.onerror = () => {
          try {
            db.close();
          } catch {}
        };
      })
  );
}

function idbSet(key, value) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_KV, "readwrite");
        const store = tx.objectStore(STORE_KV);
        const req = store.put(value, key);

        req.onsuccess = () => resolve(true);
        req.onerror = () => reject(req.error || new Error("IndexedDB set failed"));

        tx.oncomplete = () => {
          try {
            db.close();
          } catch {}
        };
        tx.onerror = () => {
          try {
            db.close();
          } catch {}
        };
      })
  );
}

function extractAudioAttachment(audioData) {
  if (!audioData) return null;

  const value = String(audioData);

  if (value.startsWith("data:")) {
    const parts = value.split(",");
    if (parts.length < 2) return null;

    const meta = parts[0];
    const base64 = parts[1];
    if (!base64) return null;

    const metaAfterPrefix = meta.split(":")[1] || "";
    const contentType = metaAfterPrefix.split(";")[0] || "audio/webm";

    return { contentType, data: base64 };
  }

  return { contentType: "audio/webm", data: value };
}

async function ensureMedplumPatient(patient) {
  if (!hasMedplumSession()) return null;

  const idNumber = trimId(patient?.idNumber);
  if (!idNumber) return null;

  if (patient?.medplumId) return patient.medplumId;

  try {
    const searchBundle = await medplum.search("Patient", {
      identifier: `${ID_SYSTEM}|${idNumber}`,
    });
    const existing = searchBundle.entry?.[0]?.resource;

    const baseFhir = toFhirPatient(patient);

    if (existing?.id) {
      try {
        const updated = await medplum.updateResource({
          ...existing,
          ...baseFhir,
          id: existing.id,
        });
        return updated?.id || existing.id;
      } catch {
        return existing.id;
      }
    }

    try {
      const created = await medplum.createResource(baseFhir);
      return created?.id || null;
    } catch {
      return null;
    }
  } catch {
    return null;
  }
}

/**
 * Prevent "import resets": never overwrite existing values with empty strings / empty arrays.
 * Keep existing unless incoming has a meaningful value.
 */
function preferNonEmpty(existingValue, incomingValue) {
  if (incomingValue === undefined || incomingValue === null) return existingValue;

  if (typeof incomingValue === "string") {
    const t = incomingValue.trim();
    return t === "" ? existingValue : incomingValue;
  }

  if (Array.isArray(incomingValue)) {
    return incomingValue.length === 0 ? existingValue : incomingValue;
  }

  return incomingValue;
}

function mergeNonEmptyFields(existing, incoming) {
  const out = { ...existing };
  for (const [k, v] of Object.entries(incoming || {})) {
    out[k] = preferNonEmpty(out[k], v);
  }
  return out;
}

function mergePatients(prev, incoming, historyByIdNumber, reportsByIdNumber) {
  const map = new Map();

  ensureArray(prev).forEach((p) => {
    const key = trimId(p.idNumber || p.id || p.medplumId);
    if (!key) return;
    map.set(key, normalizePatientPreserve(p));
  });

  ensureArray(incoming).forEach((imp) => {
    const key = trimId(imp.idNumber || imp.id || imp.medplumId);
    if (!key) return;

    const existing = map.get(key);

    const importedHistory = (historyByIdNumber?.get?.(key) ?? imp?.history) || [];
    const importedReports = (reportsByIdNumber?.get?.(key) ?? imp?.reports) || [];

    if (existing) {
      const mergedHistory = [...ensureArray(existing.history), ...ensureArray(importedHistory)];
      const uniqueHistory = [];
      const seenHistoryIds = new Set();
      mergedHistory.forEach((item) => {
        const id = item?.id || `${item?.date || ""}-${item?.title || ""}-${item?.summary || ""}`;
        if (seenHistoryIds.has(id)) return;
        seenHistoryIds.add(id);
        uniqueHistory.push(item);
      });

      const mergedReports = [...ensureArray(existing.reports), ...ensureArray(importedReports)];
      const uniqueReports = [];
      const seenReportIds = new Set();
      mergedReports.forEach((report) => {
        const id = report?.id || `${report?.date || ""}-${report?.name || ""}-${report?.description || ""}`;
        if (seenReportIds.has(id)) return;
        seenReportIds.add(id);
        uniqueReports.push(report);
      });

      map.set(
        key,
        normalizePatientPreserve({
          ...mergeNonEmptyFields(existing, imp),
          idNumber: key,
          history: uniqueHistory,
          reports: uniqueReports,
        })
      );
    } else {
      map.set(
        key,
        normalizePatientPreserve({
          ...imp,
          idNumber: key,
          history: ensureArray(importedHistory),
          reports: ensureArray(importedReports),
        })
      );
    }
  });

  return Array.from(map.values()).map(normalizePatientPreserve);
}

function cleanUpdate(obj) {
  const cleaned = {};
  const allowEmptyStringKeys = new Set(["dob", "street", "city", "zipCode"]);

  for (const [key, value] of Object.entries(obj || {})) {
    if (value === undefined || value === null) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed === "" && !allowEmptyStringKeys.has(key)) continue;
      cleaned[key] = trimmed;
      continue;
    }

    if ((key === "history" || key === "reports") && Array.isArray(value) && value.length === 0) {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

/**
 * Helper: search single resource by identifier (system|value)
 */
async function findByIdentifier(resourceType, identifierSystem, identifierValue) {
  try {
    const bundle = await medplum.search(resourceType, {
      identifier: `${identifierSystem}|${identifierValue}`,
      _count: 1,
    });
    const res = bundle?.entry?.[0]?.resource || null;
    return res;
  } catch {
    return null;
  }
}

/**
 * Helper: create only if missing by identifier
 */
async function createIfMissing(resourceType, identifierSystem, identifierValue, resource) {
  const existing = await findByIdentifier(resourceType, identifierSystem, identifierValue);
  if (existing?.id) return existing;
  return await medplum.createResource(resource);
}

export function usePatients() {
  const [patients, setPatients] = useState([]);
  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatientIdNumber, setSelectedPatientIdNumber] = useState(null);

  const persistChainRef = useRef(Promise.resolve());

  useEffect(() => {
    let cancelled = false;

    async function loadFromIdbOrMigrate() {
      try {
        const fromIdb = await idbGet(KV_PATIENTS);
        const arr = Array.isArray(fromIdb) ? fromIdb : null;

        if (arr && arr.length > 0) {
          if (!cancelled) setPatients(arr.map(normalizePatientPreserve));
          return;
        }

        // Migration: localStorage -> IndexedDB (one-time, add-only baseline)
        const fromLocal = loadPatientsFromLocalStorage();
        if (fromLocal.length > 0) {
          await idbSet(KV_PATIENTS, fromLocal.map(normalizePatientPreserve));
          safeWriteLocalBackup(fromLocal);
          if (!cancelled) setPatients(fromLocal.map(normalizePatientPreserve));
          return;
        }

        if (!cancelled) setPatients([]);
      } catch {
        // If IndexedDB fails, fall back to localStorage only.
        const fromLocal = loadPatientsFromLocalStorage();
        if (!cancelled) setPatients(fromLocal.map(normalizePatientPreserve));
      }
    }

    loadFromIdbOrMigrate();

    return () => {
      cancelled = true;
    };
  }, []);

  const findPatientById = (idNumber) =>
    patients.find((p) => trimId(p.idNumber) === trimId(idNumber)) || null;

  const selectedPatient = findPatientById(selectedPatientIdNumber);
  const selectedPatientFullName = selectedPatient
    ? [selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(" ")
    : "";

  const persistPatients = (nextPatients) => {
    const safe = Array.isArray(nextPatients) ? nextPatients.map(normalizePatientPreserve) : [];

    // Serialize writes so rapid updates do not race.
    persistChainRef.current = persistChainRef.current
      .then(async () => {
        try {
          await idbSet(KV_PATIENTS, safe);
        } catch {
          // If IndexedDB write fails, attempt local backup.
        } finally {
          safeWriteLocalBackup(safe);
        }
      })
      .catch(() => {
        // ignore
      });
  };

  const updatePatientsWithSave = (updater) => {
    setPatients((prev) => {
      const updated = typeof updater === "function" ? updater(prev) : updater;
      const safe = Array.isArray(updated) ? updated.map(normalizePatientPreserve) : [];
      persistPatients(safe);
      return safe;
    });
  };

  async function createOrUpdateMedplumPatient(updatedPatient) {
    if (!hasMedplumSession()) return;

    const medplumId = await ensureMedplumPatient(updatedPatient);
    if (!medplumId) return;

    updatePatientsWithSave((prev) =>
      prev.map((p) =>
        trimId(p.idNumber) === trimId(updatedPatient.idNumber) ? { ...p, medplumId } : p
      )
    );
  }

  const syncToMedplum = async (patient, errorContext = "patient") => {
    if (!hasMedplumSession()) return;
    try {
      await createOrUpdateMedplumPatient(patient);
    } catch {
      alert(`Failed to sync ${errorContext} to Medplum. Check your connection.`);
    }
  };

  const patientIdExists = (idNumber) => patients.some((p) => trimId(p.idNumber) === trimId(idNumber));

  const handleCreatePatient = async (formData) => {
    const idNumber = trimId(formData?.idNumber);
    if (!idNumber) {
      alert("ID number is required.");
      return;
    }
    if (patientIdExists(idNumber)) {
      alert("A patient with this ID number already exists.");
      return;
    }

    const newPatient = normalizePatientPreserve({
      ...formData,
      idNumber,
      id: formData?.id || idNumber,
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

    await syncToMedplum(newPatient, "new patient");
  };

  const handleUpdatePatient = async (updatedPatient) => {
    if (!updatedPatient) return;

    const newIdNumber = trimId(updatedPatient.idNumber);

    const oldIdNumber =
      trimId(updatedPatient._originalIdNumber) || trimId(editingPatient?.idNumber) || newIdNumber;

    if (!newIdNumber && !oldIdNumber) {
      alert("ID number is required.");
      return;
    }

    const finalIdNumber = newIdNumber || oldIdNumber;

    if (
      newIdNumber &&
      oldIdNumber &&
      newIdNumber !== oldIdNumber &&
      patients.some((p) => {
        const pid = trimId(p.idNumber);
        return pid === newIdNumber && pid !== oldIdNumber;
      })
    ) {
      alert("Another patient already uses this ID number.");
      return;
    }

    const cleanedUpdate = cleanUpdate(updatedPatient);

    let updatedPatientRef = null;

    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        const pid = trimId(p.idNumber);
        if (!pid) return p;

        const matches = pid === oldIdNumber || pid === newIdNumber;
        if (!matches) return p;

        updatedPatientRef = normalizePatientPreserve({
          ...p,
          ...cleanedUpdate,
          idNumber: finalIdNumber,
          id: p.id || finalIdNumber,
        });

        if (updatedPatientRef && "_originalIdNumber" in updatedPatientRef) {
          delete updatedPatientRef._originalIdNumber;
        }

        return updatedPatientRef;
      })
    );

    if (finalIdNumber) setSelectedPatientIdNumber(finalIdNumber);
    setEditingPatient(null);

    if (updatedPatientRef) {
      await syncToMedplum(updatedPatientRef, "updated patient");
    }
  };

  const handleUpdatePatientInline = async (updatedPatient) => {
    await handleUpdatePatient(updatedPatient);
  };

  const handleCancelEdit = () => setEditingPatient(null);

  const handleEditPatient = (idNumber) => {
    const patient =
      typeof idNumber === "object" && idNumber !== null ? idNumber : findPatientById(idNumber);

    if (!patient) return;

    setEditingPatient(patient);
    setSelectedPatientIdNumber(patient.idNumber || trimId(idNumber));
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
        }
      } catch {
        alert("Failed to delete patient from Medplum.");
        return;
      }
    }

    updatePatientsWithSave((prev) => prev.filter((p) => trimId(p.idNumber) !== id));

    if (trimId(selectedPatientIdNumber) === id) setSelectedPatientIdNumber(null);
    if (editingPatient && trimId(editingPatient.idNumber) === id) setEditingPatient(null);
  };

  const handleSelectPatient = (idNumber) => {
    setSelectedPatientIdNumber(idNumber);
  };

  const handleAddReport = (idNumber, reportMeta) => {
    const trimmedId = trimId(idNumber);
    if (!trimmedId) return;

    let updatedPatientRef = null;

    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimmedId) return p;

        updatedPatientRef = normalizePatientPreserve({
          ...p,
          reports: [...ensureArray(p.reports), reportMeta],
          history: [
            ...ensureArray(p.history),
            {
              id: reportMeta.id || crypto.randomUUID(),
              type: "report",
              title: `Report attached: ${reportMeta.name}`,
              date: reportMeta.uploadedAt || new Date().toISOString(),
              summary: "PDF report was attached to the patient profile.",
              audioData: null,
            },
          ],
        });

        return updatedPatientRef;
      })
    );

    if (updatedPatientRef && hasMedplumSession()) {
      syncToMedplum(updatedPatientRef, "report attachment");
    }
  };

  const handleDeleteReport = (idNumber, reportId) => {
    const trimmedId = trimId(idNumber);
    if (!trimmedId || !reportId) return;

    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimmedId) return p;

        const nextReports = ensureArray(p.reports).filter((r) => r?.id !== reportId);
        const nextHistory = ensureArray(p.history).filter((h) => h?.id !== reportId);

        return normalizePatientPreserve({
          ...p,
          reports: nextReports,
          history: nextHistory,
        });
      })
    );
  };

  const handleExportPatients = () => {
    const safe = ensureArray(patients).map(normalizePatientPreserve);
    const json = JSON.stringify(safe, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "patients.json";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);
  };

  const handleImportPatients = (file) => {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const raw = String(reader.result || "");
        const json = JSON.parse(raw);

        const isFhirBundle =
          json && typeof json === "object" && json.resourceType === "Bundle" && Array.isArray(json.entry);

        if (!isFhirBundle) {
          const arr = Array.isArray(json)
            ? json
            : Array.isArray(json?.patients)
            ? json.patients
            : Array.isArray(json?.data)
            ? json.data
            : null;

          if (!arr) {
            alert("Invalid JSON file.");
            return;
          }

          const prepared = ensureArray(arr).map((p) =>
            normalizePatientPreserve({
              ...p,
              history: ensureArray(p?.history),
              reports: ensureArray(p?.reports),
            })
          );

          updatePatientsWithSave((prev) => mergePatients(prev, prepared));
          alert("Patients imported successfully!");
          return;
        }

        const resources = json.entry.map((entry) => entry.resource).filter(Boolean);

        const patientResources = resources.filter((res) => res.resourceType === "Patient");
        const observationResources = resources.filter((res) => res.resourceType === "Observation");
        const diagnosticResources = resources.filter((res) => res.resourceType === "DiagnosticReport");

        const importedPatients = patientResources.map(fromFhirPatient).map(normalizePatientPreserve);

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
              (ext) => ext.url === "https://medicalcare.local/extension/audioData"
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

        updatePatientsWithSave((prev) =>
          mergePatients(prev, importedPatients, historyByIdNumber, reportsByIdNumber)
        );

        alert("Patients imported successfully!");
      } catch (error) {
        console.error("[handleImportPatients] Failed:", error);
        alert("Import failed. Check console for details.");
      }
    };

    reader.readAsText(file);
  };

  const handleSaveTranscription = async (idNumber, transcriptionText, audioData) => {
    const trimmedId = trimId(idNumber);
    const cleanText = (transcriptionText || "").trim();
    const cleanAudio = audioData || null;

    if (!trimmedId) return;
    if (!cleanText && !cleanAudio) return;

    const now = new Date().toISOString();
    let updatedPatientRef = null;
    let newHistoryItemRef = null;

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

        updatedPatientRef = normalizePatientPreserve({
          ...p,
          history: [...ensureArray(p.history), historyItem],
        });

        return updatedPatientRef;
      })
    );

    if (!hasMedplumSession()) {
      alert("Transcription saved locally (no Medplum connection)");
      return;
    }

    if (!updatedPatientRef || !newHistoryItemRef) return;

    try {
      const medplumId = await ensureMedplumPatient(updatedPatientRef);
      if (!medplumId) return;

      if (!updatedPatientRef.medplumId) {
        updatePatientsWithSave((prev) =>
          prev.map((p) => (trimId(p.idNumber) === trimmedId ? { ...p, medplumId } : p))
        );
        updatedPatientRef = { ...updatedPatientRef, medplumId };
      }

      const subjectRef = `Patient/${medplumId}`;

      const observation = {
        resourceType: "Observation",
        status: "final",
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        code: { text: newHistoryItemRef.title || "Treatment transcription" },
        note: cleanText ? [{ text: cleanText }] : [],
        identifier: [
          {
            system: APP_IDENTIFIER_SYSTEM,
            value: `${trimmedId}:history:${newHistoryItemRef.id}`,
          },
        ],
      };

      if (cleanAudio) {
        observation.extension = [
          {
            url: "https://medicalcare.local/extension/audioData",
            valueString: cleanAudio,
          },
        ];
      }

      await createIfMissing(
        "Observation",
        APP_IDENTIFIER_SYSTEM,
        `${trimmedId}:history:${newHistoryItemRef.id}`,
        observation
      );
    } catch (error) {
      console.error("[handleSaveTranscription] Medplum sync failed:", error);
      alert("Saved locally, but failed to sync transcription to Medplum.");
    }
  };

  const handleSyncAllToMedplum = async () => {
    if (!hasMedplumSession()) {
      alert("Please sign in first.");
      return;
    }

    const confirmSync = confirm(
      `This will sync ${patients.length} patients and their history/reports to Medplum. Continue?`
    );
    if (!confirmSync) return;

    try {
      const updatedPatients = [...patients];

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < updatedPatients.length; i++) {
        const p = updatedPatients[i];
        const idNumber = trimId(p.idNumber);
        if (!idNumber) continue;

        try {
          let medplumId = p.medplumId || null;

          try {
            medplumId = (await ensureMedplumPatient({ ...p, medplumId: null })) || medplumId;
          } catch (e) {
            errorCount++;
            errors.push(`${p.firstName} ${p.lastName}: ${e?.message || "Ensure patient failed"}`);
            continue;
          }

          if (!medplumId) {
            errorCount++;
            errors.push(`${p.firstName} ${p.lastName}: Could not get Medplum ID`);
            continue;
          }

          updatedPatients[i] = { ...p, medplumId };

          const subjectRef = `Patient/${medplumId}`;

          // History (Observations) - create only if missing
          const history = ensureArray(updatedPatients[i].history);
          for (let j = 0; j < history.length; j++) {
            const item = history[j];
            try {
              const itemId = item?.id || `${item?.date || ""}-${item?.title || ""}-${item?.summary || ""}`;
              const dedupeKey = `${idNumber}:history:${itemId}`;

              const baseObservation = historyItemToObservation(
                { ...updatedPatients[i], medplumId },
                item,
                j
              );

              baseObservation.subject = { reference: subjectRef };
              baseObservation.identifier = [
                ...(Array.isArray(baseObservation.identifier) ? baseObservation.identifier : []),
                { system: APP_IDENTIFIER_SYSTEM, value: dedupeKey },
              ];

              await createIfMissing("Observation", APP_IDENTIFIER_SYSTEM, dedupeKey, baseObservation);

              // Audio as Media - optional: also dedupe
              if (item.audioData) {
                const attachment = extractAudioAttachment(item.audioData);
                if (attachment) {
                  const mediaKey = `${idNumber}:media:${itemId}`;
                  const media = {
                    resourceType: "Media",
                    status: "completed",
                    subject: { reference: subjectRef },
                    createdDateTime: item.date || new Date().toISOString(),
                    identifier: [{ system: APP_IDENTIFIER_SYSTEM, value: mediaKey }],
                    content: {
                      contentType: attachment.contentType,
                      data: attachment.data,
                    },
                  };
                  await createIfMissing("Media", APP_IDENTIFIER_SYSTEM, mediaKey, media);
                }
              }
            } catch {}
          }

          // Reports (DiagnosticReport) - create only if missing
          const reports = ensureArray(updatedPatients[i].reports);
          for (let k = 0; k < reports.length; k++) {
            const rep = reports[k];
            try {
              const repId = rep?.id || `${rep?.date || ""}-${rep?.name || ""}-${rep?.description || ""}`;
              const dedupeKey = `${idNumber}:report:${repId}`;

              const dr = reportToDiagnosticReport({ ...updatedPatients[i], medplumId }, rep, k);
              dr.subject = { reference: subjectRef };
              dr.identifier = [
                ...(Array.isArray(dr.identifier) ? dr.identifier : []),
                { system: APP_IDENTIFIER_SYSTEM, value: dedupeKey },
              ];

              await createIfMissing("DiagnosticReport", APP_IDENTIFIER_SYSTEM, dedupeKey, dr);
            } catch (reportError) {
              if (import.meta.env.DEV) {
                console.warn(`[handleSyncAllToMedplum] Failed report ${k + 1}:`, reportError);
              }
            }
          }

          successCount++;
        } catch (error) {
          errorCount++;
          errors.push(`${p.firstName} ${p.lastName}: ${error?.message || "Unknown error"}`);
        }
      }

      updatePatientsWithSave(updatedPatients);

      let message = `Full sync completed!\n\n`;
      message += `Success: ${successCount} patients\n`;
      if (errorCount > 0) {
        message += `Failed: ${errorCount} patients\n\n`;
        message += `Check console for details.`;
        console.error("[handleSyncAllToMedplum] Errors:", errors);
      } else {
        message += `All data is now in Medplum.`;
      }

      alert(message);
    } catch (error) {
      console.error("[handleSyncAllToMedplum] FULL SYNC FAILED:", error);
      alert("Full sync to Medplum failed. Check console for details.");
    }
  };

  return {
    patients,
    selectedPatient,
    selectedPatientFullName,
    editingPatient,

    handleCreatePatient,
    handleAddPatient: handleCreatePatient,
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
