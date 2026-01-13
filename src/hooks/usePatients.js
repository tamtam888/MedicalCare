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

const DB_NAME = "medicalcare_local";
const DB_VERSION = 1;
const STORE_KV = "kv";
const KV_PATIENTS = "patients_v1";

const APP_IDENTIFIER_SYSTEM = "https://medicalcare.app/identifiers";

const safeUuid = () => {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
};

const normalizePatientPreserve = (patient) => {
  const base = normalizePatient(patient);
  return {
    ...base,
    history: ensureArray(patient?.history ?? base?.history),
    reports: ensureArray(patient?.reports ?? base?.reports),
    carePlans: ensureArray(patient?.carePlans ?? base?.carePlans),
    medplumId: patient?.medplumId ?? base?.medplumId ?? null,
    medplumSyncedAt: patient?.medplumSyncedAt ?? null,
    medplumSyncStatus: patient?.medplumSyncStatus ?? "local",
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

  try {
    window.localStorage.setItem(`${STORAGE_KEY}_backup`, json);
  } catch {}
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

function mergeUniqueById(list, makeFallbackId) {
  const out = [];
  const seen = new Set();
  ensureArray(list).forEach((item, idx) => {
    const id = item?.id || makeFallbackId(item, idx);
    if (!id) return;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ ...item, id: item?.id || id });
  });
  return out;
}

function mergePatients(prev, incoming, historyByIdNumber, reportsByIdNumber, carePlansByIdNumber) {
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
    const importedCarePlans = (carePlansByIdNumber?.get?.(key) ?? imp?.carePlans) || [];

    if (existing) {
      const mergedHistory = mergeUniqueById(
        [...ensureArray(existing.history), ...ensureArray(importedHistory)],
        (item) => `${item?.date || ""}-${item?.title || ""}-${item?.summary || ""}`
      );

      const mergedReports = mergeUniqueById(
        [...ensureArray(existing.reports), ...ensureArray(importedReports)],
        (report) => `${report?.date || ""}-${report?.name || ""}-${report?.description || ""}`
      );

      const mergedCarePlans = mergeUniqueById(
        [...ensureArray(existing.carePlans), ...ensureArray(importedCarePlans)],
        (cp) => `${cp?.createdAt || cp?.date || ""}-${cp?.title || cp?.name || ""}-${cp?.description || ""}`
      );

      map.set(
        key,
        normalizePatientPreserve({
          ...mergeNonEmptyFields(existing, imp),
          idNumber: key,
          history: mergedHistory,
          reports: mergedReports,
          carePlans: mergedCarePlans,
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
          carePlans: ensureArray(importedCarePlans),
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

    if (
      (key === "history" || key === "reports" || key === "carePlans") &&
      Array.isArray(value) &&
      value.length === 0
    ) {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

async function findByIdentifier(resourceType, identifierSystem, identifierValue) {
  try {
    const bundle = await medplum.search(resourceType, {
      identifier: `${identifierSystem}|${identifierValue}`,
      _count: 1,
    });
    return bundle?.entry?.[0]?.resource || null;
  } catch {
    return null;
  }
}

async function createIfMissing(resourceType, identifierSystem, identifierValue, resource) {
  const existing = await findByIdentifier(resourceType, identifierSystem, identifierValue);
  if (existing?.id) return existing;
  return await medplum.createResource(resource);
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

function carePlanItemToCarePlan(patient, carePlanItem) {
  const now = new Date().toISOString();
  const createdAt = carePlanItem?.createdAt || carePlanItem?.date || now;

  const status = carePlanItem?.status || "active";
  const intent = carePlanItem?.intent || "plan";
  const title = carePlanItem?.title || carePlanItem?.name || "Care Plan";
  const description = carePlanItem?.description || "";

  return {
    resourceType: "CarePlan",
    status,
    intent,
    subject: patient?.medplumId ? { reference: `Patient/${patient.medplumId}` } : undefined,
    period: { start: createdAt },
    title,
    description,
  };
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

        const fromLocal = loadPatientsFromLocalStorage();
        if (fromLocal.length > 0) {
          await idbSet(KV_PATIENTS, fromLocal.map(normalizePatientPreserve));
          safeWriteLocalBackup(fromLocal);
          if (!cancelled) setPatients(fromLocal.map(normalizePatientPreserve));
          return;
        }

        if (!cancelled) setPatients([]);
      } catch {
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

    persistChainRef.current = persistChainRef.current
      .then(async () => {
        try {
          await idbSet(KV_PATIENTS, safe);
        } catch {
        } finally {
          safeWriteLocalBackup(safe);
        }
      })
      .catch(() => {});
  };

  const updatePatientsWithSave = (updater) => {
    setPatients((prev) => {
      const updated = typeof updater === "function" ? updater(prev) : updater;
      const safe = Array.isArray(updated) ? updated.map(normalizePatientPreserve) : [];
      persistPatients(safe);
      return safe;
    });
  };

  const patientIdExists = (idNumber) =>
    patients.some((p) => trimId(p.idNumber) === trimId(idNumber));

  async function syncOnePatientToMedplum(patient) {
    if (!hasMedplumSession()) throw new Error("No Medplum session");

    const idNumber = trimId(patient?.idNumber);
    if (!idNumber) throw new Error("Missing patient idNumber");

    let medplumId = patient.medplumId || null;
    medplumId = (await ensureMedplumPatient({ ...patient, medplumId: null })) || medplumId;
    if (!medplumId) throw new Error("Could not get Medplum ID");

    const subjectRef = `Patient/${medplumId}`;

    const history = ensureArray(patient.history);
    for (let j = 0; j < history.length; j++) {
      const item = history[j];
      const itemId = item?.id || `${item?.date || ""}-${item?.title || ""}-${item?.summary || ""}`;
      const dedupeKey = `${idNumber}:history:${itemId}`;

      const baseObservation = historyItemToObservation({ ...patient, medplumId }, item, j);
      baseObservation.subject = { reference: subjectRef };
      baseObservation.identifier = [
        ...(Array.isArray(baseObservation.identifier) ? baseObservation.identifier : []),
        { system: APP_IDENTIFIER_SYSTEM, value: dedupeKey },
      ];

      await createIfMissing("Observation", APP_IDENTIFIER_SYSTEM, dedupeKey, baseObservation);

      if (item?.audioData) {
        const attachment = extractAudioAttachment(item.audioData);
        if (attachment?.data) {
          const mediaKey = `${idNumber}:media:${itemId}`;
          const media = {
            resourceType: "Media",
            status: "completed",
            subject: { reference: subjectRef },
            createdDateTime: item?.date || new Date().toISOString(),
            identifier: [{ system: APP_IDENTIFIER_SYSTEM, value: mediaKey }],
            content: {
              contentType: attachment.contentType || "audio/webm",
              data: attachment.data,
            },
          };
          await createIfMissing("Media", APP_IDENTIFIER_SYSTEM, mediaKey, media);
        }
      }
    }

    const reports = ensureArray(patient.reports);
    for (let k = 0; k < reports.length; k++) {
      const rep = reports[k];
      const repId = rep?.id || `${rep?.date || ""}-${rep?.name || ""}-${rep?.description || ""}`;
      const dedupeKey = `${idNumber}:report:${repId}`;

      const dr = reportToDiagnosticReport({ ...patient, medplumId }, rep, k);
      dr.subject = { reference: subjectRef };
      dr.identifier = [
        ...(Array.isArray(dr.identifier) ? dr.identifier : []),
        { system: APP_IDENTIFIER_SYSTEM, value: dedupeKey },
      ];

      await createIfMissing("DiagnosticReport", APP_IDENTIFIER_SYSTEM, dedupeKey, dr);
    }

    const carePlans = ensureArray(patient.carePlans);
    for (let c = 0; c < carePlans.length; c++) {
      const cp = carePlans[c];
      const cpId =
        cp?.id ||
        `${cp?.createdAt || cp?.date || ""}-${cp?.title || cp?.name || ""}-${cp?.description || ""}`;
      const dedupeKey = `${idNumber}:careplan:${cpId}`;

      const carePlan = carePlanItemToCarePlan({ ...patient, medplumId }, { ...cp, id: cpId });
      carePlan.subject = { reference: subjectRef };
      carePlan.identifier = [{ system: APP_IDENTIFIER_SYSTEM, value: dedupeKey }];

      await createIfMissing("CarePlan", APP_IDENTIFIER_SYSTEM, dedupeKey, carePlan);
    }

    return medplumId;
  }

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
          id: safeUuid(),
          type: "note",
          title: "Patient profile created",
          date: new Date().toISOString(),
          summary: "Initial patient profile was created in the system.",
          audioData: null,
        },
      ],
      reports: [],
      carePlans: [],
      medplumId: null,
      medplumSyncedAt: null,
      medplumSyncStatus: "local",
    });

    updatePatientsWithSave((prev) => [...prev, newPatient]);
    setSelectedPatientIdNumber(idNumber);
    setEditingPatient(null);

    if (hasMedplumSession()) {
      try {
        const medplumId = await syncOnePatientToMedplum(newPatient);
        updatePatientsWithSave((prev) =>
          prev.map((p) =>
            trimId(p.idNumber) === idNumber
              ? {
                  ...p,
                  medplumId,
                  medplumSyncedAt: new Date().toISOString(),
                  medplumSyncStatus: "ok",
                }
              : p
          )
        );
      } catch {
        updatePatientsWithSave((prev) =>
          prev.map((p) =>
            trimId(p.idNumber) === idNumber ? { ...p, medplumSyncStatus: "error" } : p
          )
        );
      }
    }
  };

  const handleUpdatePatient = async (updatedPatient) => {
    if (!updatedPatient) return;

    const newIdNumber = trimId(updatedPatient.idNumber);
    const oldIdNumber =
      trimId(updatedPatient._originalIdNumber) ||
      trimId(editingPatient?.idNumber) ||
      newIdNumber;

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

    updatePatientsWithSave((prev) => prev.filter((p) => trimId(p.idNumber) !== id));

    if (trimId(selectedPatientIdNumber) === id) setSelectedPatientIdNumber(null);
    if (editingPatient && trimId(editingPatient.idNumber) === id) setEditingPatient(null);
  };

  const handleSelectPatient = (idNumber) => {
    setSelectedPatientIdNumber(idNumber);
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
          json &&
          typeof json === "object" &&
          json.resourceType === "Bundle" &&
          Array.isArray(json.entry);

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
              carePlans: ensureArray(p?.carePlans),
            })
          );

          updatePatientsWithSave((prev) => mergePatients(prev, prepared));
          alert("Patients imported successfully!");
          return;
        }

        const resources = json.entry.map((entry) => entry.resource).filter(Boolean);

        const patientResources = resources.filter((res) => res.resourceType === "Patient");
        const observationResources = resources.filter((res) => res.resourceType === "Observation");
        const diagnosticResources = resources.filter(
          (res) => res.resourceType === "DiagnosticReport"
        );
        const carePlanResources = resources.filter((res) => res.resourceType === "CarePlan");

        const importedPatients = patientResources.map(fromFhirPatient).map(normalizePatientPreserve);

        const historyByIdNumber = new Map();
        observationResources.forEach((obs) => {
          const ref = obs.subject?.reference || "";
          const match = ref.match(/^Patient\/(.+)$/);
          if (!match) return;
          const idNumber = trimId(match[1]);
          if (!idNumber) return;

          const list = historyByIdNumber.get(idNumber) || [];
          list.push({
            id: obs.id || safeUuid(),
            type: "transcription",
            title: obs.code?.text || "History item",
            date: obs.effectiveDateTime || "",
            summary:
              Array.isArray(obs.note) && obs.note[0]?.text ? obs.note[0].text : obs.valueString || "",
            audioData: null,
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
            id: dr.id || safeUuid(),
            name: dr.code?.text || "Report",
            type: "report",
            date: dr.effectiveDateTime || "",
            uploadedAt: dr.effectiveDateTime || "",
            description: dr.conclusion || "",
          });
          reportsByIdNumber.set(idNumber, list);
        });

        const carePlansByIdNumber = new Map();
        carePlanResources.forEach((cp) => {
          const ref = cp.subject?.reference || "";
          const match = ref.match(/^Patient\/(.+)$/);
          if (!match) return;
          const idNumber = trimId(match[1]);
          if (!idNumber) return;

          const list = carePlansByIdNumber.get(idNumber) || [];
          list.push({
            id: cp.id || safeUuid(),
            title: cp.title || "Care Plan",
            name: cp.title || "Care Plan",
            description: cp.description || "",
            status: cp.status || "active",
            intent: cp.intent || "plan",
            createdAt: cp.period?.start || "",
            date: cp.period?.start || "",
          });
          carePlansByIdNumber.set(idNumber, list);
        });

        updatePatientsWithSave((prev) =>
          mergePatients(prev, importedPatients, historyByIdNumber, reportsByIdNumber, carePlansByIdNumber)
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
          id: safeUuid(),
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

    if (!hasMedplumSession() || !updatedPatientRef || !newHistoryItemRef) return;

    try {
      const medplumId = await ensureMedplumPatient(updatedPatientRef);
      if (!medplumId) return;

      const subjectRef = `Patient/${medplumId}`;
      const historyKey = `${trimmedId}:history:${newHistoryItemRef.id}`;

      const observation = {
        resourceType: "Observation",
        status: "final",
        subject: { reference: subjectRef },
        effectiveDateTime: now,
        code: { text: newHistoryItemRef.title || "Treatment transcription" },
        note: cleanText ? [{ text: cleanText }] : [],
        identifier: [{ system: APP_IDENTIFIER_SYSTEM, value: historyKey }],
      };

      await createIfMissing("Observation", APP_IDENTIFIER_SYSTEM, historyKey, observation);

      if (cleanAudio) {
        const attachment = extractAudioAttachment(cleanAudio);
        if (attachment?.data) {
          const mediaKey = `${trimmedId}:media:${newHistoryItemRef.id}`;
          const media = {
            resourceType: "Media",
            status: "completed",
            subject: { reference: subjectRef },
            createdDateTime: now,
            identifier: [{ system: APP_IDENTIFIER_SYSTEM, value: mediaKey }],
            content: {
              contentType: attachment.contentType || "audio/webm",
              data: attachment.data,
            },
          };
          await createIfMissing("Media", APP_IDENTIFIER_SYSTEM, mediaKey, media);
        }
      }
    } catch (error) {
      console.error("[handleSaveTranscription] Medplum sync failed:", error);
    }
  };

  const handleSaveReportEntry = async (idNumber, reportEntry) => {
    const trimmedId = trimId(idNumber);
    if (!trimmedId) return;

    const now = new Date().toISOString();

    const rep = {
      id: reportEntry?.id || safeUuid(),
      name: reportEntry?.name || "Report",
      type: reportEntry?.type || "report",
      description: reportEntry?.description || "",
      uploadedAt: reportEntry?.uploadedAt || reportEntry?.date || now,
      date: reportEntry?.date || reportEntry?.uploadedAt || now,
      pdfUrl: reportEntry?.pdfUrl || reportEntry?.url || "",
      ...reportEntry,
    };

    let updatedPatientRef = null;

    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimmedId) return p;

        updatedPatientRef = normalizePatientPreserve({
          ...p,
          reports: [...ensureArray(p.reports), rep],
          history: [
            ...ensureArray(p.history),
            {
              id: rep.id,
              type: "report",
              title: rep.name || "Report",
              date: rep.uploadedAt || now,
              summary: rep.description || "Report saved to patient.",
              audioData: null,
            },
          ],
        });

        return updatedPatientRef;
      })
    );

    if (!hasMedplumSession() || !updatedPatientRef) return;

    try {
      const medplumId = await ensureMedplumPatient(updatedPatientRef);
      if (!medplumId) return;

      const subjectRef = `Patient/${medplumId}`;
      const dedupeKey = `${trimmedId}:report:${rep.id}`;

      const dr = reportToDiagnosticReport({ ...updatedPatientRef, medplumId }, rep, 0);
      dr.subject = { reference: subjectRef };
      dr.identifier = [
        ...(Array.isArray(dr.identifier) ? dr.identifier : []),
        { system: APP_IDENTIFIER_SYSTEM, value: dedupeKey },
      ];

      await createIfMissing("DiagnosticReport", APP_IDENTIFIER_SYSTEM, dedupeKey, dr);
    } catch (error) {
      console.error("[handleSaveReportEntry] Medplum sync failed:", error);
    }
  };

  const handleAddReport = async (idNumber, reportMeta) => {
    await handleSaveReportEntry(idNumber, reportMeta);
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

  const handleSaveCarePlanEntry = async (idNumber, carePlanEntry) => {
    const trimmedId = trimId(idNumber);
    if (!trimmedId) return;

    const now = new Date().toISOString();

    const cp = {
      id: carePlanEntry?.id || safeUuid(),
      title: carePlanEntry?.title || carePlanEntry?.name || "Care Plan",
      name: carePlanEntry?.name || carePlanEntry?.title || "Care Plan",
      description: carePlanEntry?.description || "",
      status: carePlanEntry?.status || "active",
      intent: carePlanEntry?.intent || "plan",
      createdAt: carePlanEntry?.createdAt || carePlanEntry?.date || now,
      date: carePlanEntry?.date || carePlanEntry?.createdAt || now,
      ...carePlanEntry,
    };

    let updatedPatientRef = null;

    updatePatientsWithSave((prev) =>
      prev.map((p) => {
        if (trimId(p.idNumber) !== trimmedId) return p;

        const historyItem = {
          id: cp.id,
          type: "careplan",
          title: cp.title,
          date: cp.createdAt,
          summary: cp.description || "Care plan saved.",
          audioData: null,
        };

        updatedPatientRef = normalizePatientPreserve({
          ...p,
          carePlans: [...ensureArray(p.carePlans), cp],
          history: [...ensureArray(p.history), historyItem],
        });

        return updatedPatientRef;
      })
    );

    if (!hasMedplumSession() || !updatedPatientRef) return;

    try {
      const medplumId = await ensureMedplumPatient(updatedPatientRef);
      if (!medplumId) return;

      const subjectRef = `Patient/${medplumId}`;
      const dedupeKey = `${trimmedId}:careplan:${cp.id}`;

      const carePlan = carePlanItemToCarePlan({ ...updatedPatientRef, medplumId }, cp);
      carePlan.subject = { reference: subjectRef };
      carePlan.identifier = [{ system: APP_IDENTIFIER_SYSTEM, value: dedupeKey }];

      await createIfMissing("CarePlan", APP_IDENTIFIER_SYSTEM, dedupeKey, carePlan);
    } catch (error) {
      console.error("[handleSaveCarePlanEntry] Medplum sync failed:", error);
    }
  };

  const handleSyncPatientToMedplum = async (idNumber) => {
    const pid = trimId(idNumber);
    if (!pid) return;

    if (!hasMedplumSession()) {
      alert("Please sign in first.");
      return;
    }

    updatePatientsWithSave((prev) =>
      prev.map((p) => (trimId(p.idNumber) === pid ? { ...p, medplumSyncStatus: "syncing" } : p))
    );

    const patient = findPatientById(pid);
    if (!patient) return;

    try {
      const medplumId = await syncOnePatientToMedplum(patient);

      updatePatientsWithSave((prev) =>
        prev.map((p) =>
          trimId(p.idNumber) === pid
            ? {
                ...p,
                medplumId,
                medplumSyncedAt: new Date().toISOString(),
                medplumSyncStatus: "ok",
              }
            : p
        )
      );

      alert("Patient synced to Medplum.");
    } catch (e) {
      console.error("[handleSyncPatientToMedplum] Failed:", e);
      updatePatientsWithSave((prev) =>
        prev.map((p) => (trimId(p.idNumber) === pid ? { ...p, medplumSyncStatus: "error" } : p))
      );
      alert("Failed to sync patient to Medplum. Check console.");
    }
  };

  const handleSyncAllToMedplum = async () => {
    if (!hasMedplumSession()) {
      alert("Please sign in first.");
      return;
    }

    const confirmSync = confirm(
      `This will sync ${patients.length} patients and all their history/reports/care plans to Medplum. Continue?`
    );
    if (!confirmSync) return;

    const updatedPatients = [...patients];
    let successCount = 0;
    let errorCount = 0;
    const errors = [];

    for (let i = 0; i < updatedPatients.length; i++) {
      const p = updatedPatients[i];
      const idNumber = trimId(p.idNumber);
      if (!idNumber) continue;

      updatedPatients[i] = { ...p, medplumSyncStatus: "syncing" };

      try {
        const medplumId = await syncOnePatientToMedplum(updatedPatients[i]);
        updatedPatients[i] = {
          ...updatedPatients[i],
          medplumId,
          medplumSyncedAt: new Date().toISOString(),
          medplumSyncStatus: "ok",
        };
        successCount++;
      } catch (e) {
        updatedPatients[i] = { ...updatedPatients[i], medplumSyncStatus: "error" };
        errorCount++;
        errors.push(`${p.firstName} ${p.lastName}: ${e?.message || "Unknown error"}`);
      }
    }

    updatePatientsWithSave(updatedPatients);

    if (errorCount > 0) {
      console.error("[handleSyncAllToMedplum] Errors:", errors);
      alert(`Full sync finished. Success: ${successCount}. Failed: ${errorCount}. See console.`);
      return;
    }

    alert(`Full sync finished. Success: ${successCount}.`);
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

    handleExportPatients,
    handleImportPatients,

    handleSaveTranscription,

    handleAddReport,
    handleSaveReportEntry,
    handleDeleteReport,

    handleSaveCarePlanEntry,

    handleSyncPatientToMedplum,
    handleSyncAllToMedplum,
  };
}
