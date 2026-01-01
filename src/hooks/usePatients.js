<<<<<<< HEAD
import { useCallback, useEffect, useRef, useState } from "react";
=======
import { useState } from "react";
>>>>>>> refactor-ui-cleanup
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

<<<<<<< HEAD
const STORAGE_KEY = "patients:main";
const BACKUP_KEY = "patients:backup";

/**
 * IMPORTANT:
 * - Source of truth (real app): localStorage
 * - Tests: fall back to window.storage when localStorage is empty/unavailable
 * - Medplum is optional sync; never used as source-of-truth for the local list
 */

function safeParseArray(raw) {
=======
const STORAGE_KEY = "patients";

function parseStorageData(raw) {
>>>>>>> refactor-ui-cleanup
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

<<<<<<< HEAD
// Read: localStorage first, window.storage fallback (tests)
async function storageGet(key) {
  if (typeof window === "undefined") return null;

  // 1) localStorage first (real app source of truth)
  try {
    const v = window.localStorage?.getItem?.(key);
    if (v !== null && v !== undefined) return v;
  } catch {
    // ignore
  }

  // 2) fallback: window.storage (tests / special env)
  try {
    if (window?.storage?.getItem) return window.storage.getItem(key);
  } catch {
    // ignore
  }

  try {
    if (window?.storage?.get) {
      const res = await window.storage.get(key);
      return res?.value ?? null;
    }
  } catch {
    // ignore
  }

  return null;
}

// Write: always localStorage, and also window.storage if present (tests assert on it)
async function storageSet(key, value) {
  if (typeof window === "undefined") return false;

  let wrote = false;

  try {
    window.localStorage?.setItem?.(key, value);
    wrote = true;
  } catch {
    // ignore
  }

  try {
    if (window?.storage?.setItem) {
      window.storage.setItem(key, value);
      wrote = true;
    }
  } catch {
    // ignore
  }

  try {
    if (window?.storage?.set) {
      await window.storage.set(key, value);
      wrote = true;
    }
  } catch {
    // ignore
  }

  return wrote;
}

// === LOAD PATIENTS (localStorage first, window.storage fallback for tests) ===
async function loadPatientsFromStorage() {
  // Try main first
  const mainRaw = await storageGet(STORAGE_KEY);
  const mainParsed = safeParseArray(mainRaw);
  if (mainParsed && mainParsed.length > 0) {
    return mainParsed.map(normalizePatient);
  }

  // Main is empty OR corrupted -> try backup
  const backupRaw = await storageGet(BACKUP_KEY);
  const backupParsed = safeParseArray(backupRaw);
  if (backupParsed && backupParsed.length > 0) {
    const safe = backupParsed.map(normalizePatient);
    const json = JSON.stringify(safe);

    // Repair main and keep backup in sync
    await storageSet(STORAGE_KEY, json);
    await storageSet(BACKUP_KEY, json);

    return safe;
  }

  return [];
}

// === SAVE PATIENTS (writes to localStorage, mirrors to window.storage if present) ===
async function savePatientsToStorage(
  patients,
  { allowEmpty = false, allowEmptyOverwrite = false } = {}
) {
  const allowEmptyFinal = Boolean(allowEmpty || allowEmptyOverwrite);
  const safe = Array.isArray(patients) ? patients.map(normalizePatient) : [];

  // Prevent overwriting existing non-empty storage with empty array (unless explicitly allowed)
  if (!allowEmptyFinal && safe.length === 0) {
    const existingRaw = await storageGet(STORAGE_KEY);
    const existing = safeParseArray(existingRaw);
    if (existing && existing.length > 0) return;
  }

  const json = JSON.stringify(safe);
  await storageSet(STORAGE_KEY, json);
  await storageSet(BACKUP_KEY, json);
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
    cleaned[key] = value;
  }
  return cleaned;
}

function safeBase64ToText(b64) {
  if (!b64 || typeof b64 !== "string") return "";
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder().decode(bytes);
  } catch (error) {
    void error;
    return "";
=======
function loadPatientsFromLocalStorage() {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = parseStorageData(raw);
    if (parsed && parsed.length > 0) return parsed.map(normalizePatient);

    const backupRaw = window.localStorage.getItem(`${STORAGE_KEY}_backup`);
    const backupParsed = parseStorageData(backupRaw);
    if (backupParsed && backupParsed.length > 0) {
      return backupParsed.map(normalizePatient);
    }

    return [];
  } catch {
    try {
      const backupRaw = window.localStorage.getItem(`${STORAGE_KEY}_backup`);
      const backupParsed = parseStorageData(backupRaw);
      if (backupParsed && Array.isArray(backupParsed)) {
        return backupParsed.map(normalizePatient);
      }
    } catch {}
    return [];
  }
}

function savePatientsToLocalStorage(patients) {
  if (typeof window === "undefined") return;

  const safe = Array.isArray(patients) ? patients.map(normalizePatient) : [];
  const json = JSON.stringify(safe);

  try {
    window.localStorage.setItem(STORAGE_KEY, json);
    window.localStorage.setItem(`${STORAGE_KEY}_backup`, json);
  } catch {
    try {
      window.localStorage.setItem(`${STORAGE_KEY}_backup`, json);
    } catch {
      try {
        window.localStorage.removeItem(STORAGE_KEY);
        window.localStorage.setItem(STORAGE_KEY, json);
      } catch {
        alert("Failed to save patient data. Your data may be lost if you refresh!");
      }
    }
>>>>>>> refactor-ui-cleanup
  }
}

function extractAudioAttachment(audioData) {
  if (!audioData) return null;
<<<<<<< HEAD
  const value = String(audioData);
  if (value.startsWith("data:")) {
    const parts = value.split(",");
    if (parts.length < 2) return null;
    const meta = parts[0];
    const base64 = parts[1];
    if (!base64) return null;
    const contentType = meta.split(":")[1]?.split(";")[0] || "audio/webm";
    return { contentType, data: base64 };
  }
=======

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

>>>>>>> refactor-ui-cleanup
  return { contentType: "audio/webm", data: value };
}

async function ensureMedplumPatient(patient) {
  if (!hasMedplumSession()) return null;
<<<<<<< HEAD
  const idNumber = trimId(patient?.idNumber);
  if (!idNumber) return null;
  if (patient?.medplumId) return patient.medplumId;

  const baseFhir = toFhirPatient(patient);
=======

  const idNumber = trimId(patient?.idNumber);
  if (!idNumber) return null;

  if (patient?.medplumId) return patient.medplumId;
>>>>>>> refactor-ui-cleanup

  try {
    const searchBundle = await medplum.search("Patient", {
      identifier: `${ID_SYSTEM}|${idNumber}`,
    });
    const existing = searchBundle.entry?.[0]?.resource;

<<<<<<< HEAD
=======
    const baseFhir = toFhirPatient(patient);

>>>>>>> refactor-ui-cleanup
    if (existing?.id) {
      try {
        const updated = await medplum.updateResource({
          ...existing,
          ...baseFhir,
          id: existing.id,
        });
        return updated?.id || existing.id;
<<<<<<< HEAD
      } catch (error) {
        void error;
=======
      } catch {
>>>>>>> refactor-ui-cleanup
        return existing.id;
      }
    }

<<<<<<< HEAD
    const created = await medplum.createResource(baseFhir);
    return created?.id || null;
  } catch (error) {
    void error;
=======
    try {
      const created = await medplum.createResource(baseFhir);
      return created?.id || null;
    } catch {
      return null;
    }
  } catch {
>>>>>>> refactor-ui-cleanup
    return null;
  }
}

function mergePatients(prev, incoming, historyByIdNumber, reportsByIdNumber) {
  const map = new Map();

  ensureArray(prev).forEach((p) => {
    const key = trimId(p.idNumber || p.id || p.medplumId);
    if (!key) return;
    map.set(key, normalizePatient(p));
  });

<<<<<<< HEAD
  ensureArray(incoming).forEach((impRaw) => {
    const imp = normalizePatient(impRaw);
=======
  ensureArray(incoming).forEach((imp) => {
>>>>>>> refactor-ui-cleanup
    const key = trimId(imp.idNumber || imp.id || imp.medplumId);
    if (!key) return;

    const existing = map.get(key);
<<<<<<< HEAD
    const importedHistory = historyByIdNumber?.get?.(key) ?? ensureArray(imp.history);
    const importedReports = reportsByIdNumber?.get?.(key) ?? ensureArray(imp.reports);

    if (existing) {
      const mergedHistory = [...ensureArray(existing.history), ...ensureArray(importedHistory)];
      const uniqueHistory = [];
      const seenH = new Set();
      mergedHistory.forEach((h) => {
        const hid =
          h?.id || `${h?.date || ""}-${h?.title || ""}-${h?.summary || ""}-${h?.audioUrl || ""}`;
        if (seenH.has(hid)) return;
        seenH.add(hid);
        uniqueHistory.push(h);
      });

      const mergedReports = [...ensureArray(existing.reports), ...ensureArray(importedReports)];
      const uniqueReports = [];
      const seenR = new Set();
      mergedReports.forEach((r) => {
        const rid = r?.id || `${r?.date || ""}-${r?.name || ""}-${r?.description || ""}`;
        if (seenR.has(rid)) return;
        seenR.add(rid);
        uniqueReports.push(r);
=======
    const importedHistory = historyByIdNumber?.get?.(key);
    const importedReports = reportsByIdNumber?.get?.(key);

    if (existing) {
      const mergedHistory = [
        ...ensureArray(existing.history),
        ...ensureArray(importedHistory),
      ];
      const uniqueHistory = [];
      const seenHistoryIds = new Set();
      mergedHistory.forEach((item) => {
        const id =
          item?.id ||
          `${item?.date || ""}-${item?.title || ""}-${item?.summary || ""}`;
        if (seenHistoryIds.has(id)) return;
        seenHistoryIds.add(id);
        uniqueHistory.push(item);
      });

      const mergedReports = [
        ...ensureArray(existing.reports),
        ...ensureArray(importedReports),
      ];
      const uniqueReports = [];
      const seenReportIds = new Set();
      mergedReports.forEach((report) => {
        const id =
          report?.id ||
          `${report?.date || ""}-${report?.name || ""}-${report?.description || ""}`;
        if (seenReportIds.has(id)) return;
        seenReportIds.add(id);
        uniqueReports.push(report);
>>>>>>> refactor-ui-cleanup
      });

      map.set(
        key,
        normalizePatient({
          ...existing,
          ...imp,
          idNumber: key,
          history: uniqueHistory,
          reports: uniqueReports,
        })
      );
    } else {
      map.set(
        key,
        normalizePatient({
          ...imp,
          idNumber: key,
          history: ensureArray(importedHistory),
          reports: ensureArray(importedReports),
        })
      );
    }
  });

  return Array.from(map.values()).map(normalizePatient);
}

<<<<<<< HEAD
export function usePatients() {
  const [patients, setPatients] = useState([]);
  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatientIdNumber, setSelectedPatientIdNumber] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [storageLoaded, setStorageLoaded] = useState(false);
  const didAutoSyncRef = useRef(false);

  // Load from storage on mount (localStorage first; tests can use window.storage)
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const loaded = await loadPatientsFromStorage();
        if (mounted) {
          setPatients(loaded);
          setStorageLoaded(true);
          setHydrated(true);
        }
      } catch (error) {
        console.error("[usePatients] Failed to load from storage:", error);
        if (mounted) {
          setPatients([]);
          setStorageLoaded(true);
          setHydrated(true);
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Keep in sync across tabs/windows (never accept empty overwrite)
  useEffect(() => {
    if (typeof window === "undefined") return;

    async function onStorage(e) {
      if (e.key !== STORAGE_KEY && e.key !== BACKUP_KEY) return;

      const loaded = await loadPatientsFromStorage();
      if (Array.isArray(loaded) && loaded.length > 0) {
        setPatients(loaded);
      }
    }

    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Failsafe: save before tab close/refresh (still guarded from empty overwrite)
  useEffect(() => {
    if (typeof window === "undefined") return;

    function onBeforeUnload() {
      // best-effort; do not block unload
      void savePatientsToStorage(patients, { allowEmpty: false });
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [patients]);

  /**
   * Single place that:
   * - Updates state
   * - Persists to storage
   * - Prevents accidental empty overwrite
   */
  const updatePatientsWithSave = useCallback((updater, options = {}) => {
    const { allowEmpty = false, allowEmptyOverwrite = false } = options;
    const allowEmptyFinal = Boolean(allowEmpty || allowEmptyOverwrite);

    setPatients((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const safe = Array.isArray(next) ? next.map(normalizePatient) : [];

      const prevHasData = Array.isArray(prev) && prev.length > 0;
      const nextIsEmpty = safe.length === 0;

      if (!allowEmptyFinal && prevHasData && nextIsEmpty) {
        console.warn("[updatePatientsWithSave] Prevented empty overwrite");
        return prev;
      }

      savePatientsToStorage(safe, { allowEmpty: allowEmptyFinal }).catch((error) => {
        console.error("[updatePatientsWithSave] Save failed:", error);
      });

      return safe;
    });
  }, []);

  const findPatientById = useCallback(
    (idNumber) => patients.find((p) => trimId(p.idNumber) === trimId(idNumber)) || null,
    [patients]
  );
=======
/**
 * IMPORTANT FIX:
 * - previous version removed "" for ALL string fields,
 *   which prevented clearing dob/street/city/zipCode.
 * - we allow empty strings for those fields so "delete value" is saved.
 */
function cleanUpdate(obj) {
  const cleaned = {};
  const allowEmptyStringKeys = new Set(["dob", "street", "city", "zipCode"]);

  for (const [key, value] of Object.entries(obj || {})) {
    if (value === undefined || value === null) continue;

    if (typeof value === "string") {
      const trimmed = value.trim();

      // allow empty string for address/dob fields (so user can clear them)
      if (trimmed === "" && !allowEmptyStringKeys.has(key)) continue;

      cleaned[key] = trimmed;
      continue;
    }

    if (
      (key === "history" || key === "reports") &&
      Array.isArray(value) &&
      value.length === 0
    ) {
      continue;
    }

    cleaned[key] = value;
  }

  return cleaned;
}

export function usePatients() {
  const [patients, setPatients] = useState(() => loadPatientsFromLocalStorage());
  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatientIdNumber, setSelectedPatientIdNumber] = useState(null);

  const findPatientById = (idNumber) =>
    patients.find((p) => trimId(p.idNumber) === trimId(idNumber)) || null;
>>>>>>> refactor-ui-cleanup

  const selectedPatient = findPatientById(selectedPatientIdNumber);
  const selectedPatientFullName = selectedPatient
    ? [selectedPatient.firstName, selectedPatient.lastName].filter(Boolean).join(" ")
    : "";

<<<<<<< HEAD
  const patientIdExists = useCallback(
    (idNumber) => patients.some((p) => trimId(p.idNumber) === trimId(idNumber)),
    [patients]
  );

  const createOrUpdateMedplumPatient = useCallback(
    async (updatedPatient) => {
      if (!hasMedplumSession()) return;
      const medplumId = await ensureMedplumPatient(updatedPatient);
      if (!medplumId) return;

      updatePatientsWithSave((prev) =>
        prev.map((p) =>
          trimId(p.idNumber) === trimId(updatedPatient.idNumber) ? { ...p, medplumId } : p
        )
      );
    },
    [updatePatientsWithSave]
  );

  const syncToMedplum = useCallback(
    async (patient) => {
      if (!hasMedplumSession()) return;
      try {
        await createOrUpdateMedplumPatient(patient);
      } catch (error) {
        void error;
      }
    },
    [createOrUpdateMedplumPatient]
  );

  const handleCreatePatient = useCallback(
    async (formData) => {
      const idNumber = trimId(formData?.idNumber);
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
        id: formData?.id || idNumber,
        history: ensureArray(formData?.history).length
          ? ensureArray(formData.history)
          : [
              {
                id: crypto.randomUUID(),
                type: "Note",
                title: "Patient profile created",
                date: new Date().toISOString(),
                summary: "Initial patient profile was created in the system.",
                audioData: null,
                audioUrl: "",
                audioMimeType: "",
              },
            ],
        reports: ensureArray(formData?.reports),
      });

      updatePatientsWithSave((prev) => [...prev, newPatient]);
      setSelectedPatientIdNumber(idNumber);
      setEditingPatient(null);

      // Optional sync (never blocks local persistence)
      await syncToMedplum(newPatient);
    },
    [patientIdExists, syncToMedplum, updatePatientsWithSave]
  );

  const handleUpdatePatient = useCallback(
    async (updatedPatient) => {
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

          const next = normalizePatient({
            ...p,
            ...cleanedUpdate,
            idNumber: finalIdNumber,
            id: p.id || finalIdNumber,
            history: ensureArray(p.history),
            reports: ensureArray(p.reports),
          });

          if ("_originalIdNumber" in next) delete next._originalIdNumber;
          updatedPatientRef = next;
          return next;
        })
      );

      if (finalIdNumber) setSelectedPatientIdNumber(finalIdNumber);
      setEditingPatient(null);

      if (updatedPatientRef) {
        await syncToMedplum(updatedPatientRef);
      }
    },
    [editingPatient?.idNumber, patients, syncToMedplum, updatePatientsWithSave]
  );

  const handleUpdatePatientInline = useCallback(
    async (updatedPatient) => {
      await handleUpdatePatient(updatedPatient);
    },
    [handleUpdatePatient]
  );

  const handleCancelEdit = useCallback(() => setEditingPatient(null), []);

  const handleEditPatient = useCallback(
    (idNumber) => {
      const patient =
        typeof idNumber === "object" && idNumber !== null ? idNumber : findPatientById(idNumber);
      if (!patient) return;
      setEditingPatient(patient);
      setSelectedPatientIdNumber(patient.idNumber || trimId(idNumber));
    },
    [findPatientById]
  );

  const handleDeletePatient = useCallback(
    async (idNumber) => {
      const id = trimId(idNumber);
      if (!id) return;

      const patient = patients.find((p) => trimId(p.idNumber) === id);

      // Optional: delete from Medplum if logged in (never clears local list due to auth)
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
        } catch (error) {
          void error;
          alert("Failed to delete patient from Medplum.");
          return;
        }
      }

      updatePatientsWithSave((prev) => prev.filter((p) => trimId(p.idNumber) !== id));

      if (trimId(selectedPatientIdNumber) === id) setSelectedPatientIdNumber(null);
      if (editingPatient && trimId(editingPatient.idNumber) === id) setEditingPatient(null);
    },
    [editingPatient, patients, selectedPatientIdNumber, updatePatientsWithSave]
  );

  const handleSelectPatient = useCallback((idNumber) => {
    setSelectedPatientIdNumber(idNumber);
  }, []);

  const handleAddReport = useCallback(
    (idNumber, reportMeta) => {
      const trimmedId = trimId(idNumber);
      if (!trimmedId) return;

      let updatedPatientRef = null;

      updatePatientsWithSave((prev) =>
        prev.map((p) => {
          if (trimId(p.idNumber) !== trimmedId) return p;

          const next = normalizePatient({
            ...p,
            reports: [...ensureArray(p.reports), reportMeta],
            history: [
              ...ensureArray(p.history),
              {
                id: reportMeta.id || crypto.randomUUID(),
                type: "Report",
                title: `Report attached: ${reportMeta.name}`,
                date: reportMeta.uploadedAt || new Date().toISOString(),
                summary: "PDF report was attached to the patient profile.",
                audioData: null,
                audioUrl: "",
                audioMimeType: "",
              },
            ],
          });

          updatedPatientRef = next;
          return next;
        })
      );

      if (updatedPatientRef) syncToMedplum(updatedPatientRef);
    },
    [syncToMedplum, updatePatientsWithSave]
  );

  const handleDeleteReport = useCallback(
    (idNumber, reportId) => {
      const trimmedId = trimId(idNumber);
      if (!trimmedId || !reportId) return;

      updatePatientsWithSave((prev) =>
        prev.map((p) => {
          if (trimId(p.idNumber) !== trimmedId) return p;

          const nextReports = ensureArray(p.reports).filter((r) => r?.id !== reportId);
          const nextHistory = ensureArray(p.history).filter((h) => h?.id !== reportId);

          return normalizePatient({
            ...p,
            reports: nextReports,
            history: nextHistory,
          });
        })
      );
    },
    [updatePatientsWithSave]
  );

  const handleExportPatients = useCallback(() => {
=======
  const updatePatientsWithSave = (updater) => {
    setPatients((prev) => {
      const updated = typeof updater === "function" ? updater(prev) : updater;
      const safe = Array.isArray(updated) ? updated.map(normalizePatient) : [];
      savePatientsToLocalStorage(safe);
      return safe;
    });
  };

  async function createOrUpdateMedplumPatient(updatedPatient) {
    if (!hasMedplumSession()) return;

    const medplumId = await ensureMedplumPatient(updatedPatient);
    if (!medplumId) return;

    updatePatientsWithSave((prev) =>
      prev.map((p) =>
        trimId(p.idNumber) === trimId(updatedPatient.idNumber)
          ? { ...p, medplumId }
          : p
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

  const patientIdExists = (idNumber) =>
    patients.some((p) => trimId(p.idNumber) === trimId(idNumber));

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

    const newPatient = normalizePatient({
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

    /**
     * 🔧 BUGFIX:
     * The previous code used updatedPatient.id as "old idNumber",
     * but `id` can be Medplum id / something else, so the map() never matched the patient.
     *
     * We now determine the "old idNumber" from:
     * 1) updatedPatient._originalIdNumber (if you add it in PatientForm - best)
     * 2) editingPatient.idNumber (available because you setEditingPatient(patient) on edit)
     * 3) fallback to updatedPatient.idNumber
     */
    const oldIdNumber =
      trimId(updatedPatient._originalIdNumber) ||
      trimId(editingPatient?.idNumber) ||
      newIdNumber;

    if (!newIdNumber && !oldIdNumber) {
      alert("ID number is required.");
      return;
    }

    const finalIdNumber = newIdNumber || oldIdNumber;

    // Prevent duplicates if idNumber changed
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

        updatedPatientRef = normalizePatient({
          ...p,
          ...cleanedUpdate,
          idNumber: finalIdNumber,

          // keep id stable, but don't let it break matching
          id: p.id || finalIdNumber,
        });

        // don't persist helper field if it exists
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
      typeof idNumber === "object" && idNumber !== null
        ? idNumber
        : findPatientById(idNumber);

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

        updatedPatientRef = normalizePatient({
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

        return normalizePatient({
          ...p,
          reports: nextReports,
          history: nextHistory,
        });
      })
    );
  };

  const handleExportPatients = () => {
>>>>>>> refactor-ui-cleanup
    const safe = ensureArray(patients).map(normalizePatient);
    const json = JSON.stringify(safe, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
<<<<<<< HEAD
=======

>>>>>>> refactor-ui-cleanup
    const a = document.createElement("a");
    a.href = url;
    a.download = "patients.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
<<<<<<< HEAD
    URL.revokeObjectURL(url);
  }, [patients]);

  const handleImportPatients = useCallback(
    (file) => {
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

            const normalized = arr.map(normalizePatient).map((p) => ({
              ...p,
              history: ensureArray(p.history),
              reports: ensureArray(p.reports),
            }));

            updatePatientsWithSave((prev) => mergePatients(prev, normalized));
            alert("Patients imported successfully!");
            return;
          }

          // FHIR Bundle import logic (unchanged)
          const resources = json.entry.map((entry) => entry.resource).filter(Boolean);
          const patientResources = resources.filter((res) => res.resourceType === "Patient");
          const observationResources = resources.filter((res) => res.resourceType === "Observation");
          const diagnosticResources = resources.filter(
            (res) => res.resourceType === "DiagnosticReport"
          );
          const documentReferenceResources = resources.filter(
            (res) => res.resourceType === "DocumentReference"
          );

          const importedPatients = patientResources.map(fromFhirPatient);

          const medplumIdToIdNumber = new Map();
          patientResources.forEach((p) => {
            const converted = fromFhirPatient(p);
            const idNumber = trimId(converted?.idNumber || "");
            if (p?.id && idNumber) medplumIdToIdNumber.set(p.id, idNumber);
          });

          const historyByIdNumber = new Map();
          observationResources.forEach((obs) => {
            const ref = obs.subject?.reference || "";
            const match = ref.match(/^Patient\/(.+)$/);
            if (!match) return;

            const patientMedplumId = match[1];
            const idNumber = trimId(medplumIdToIdNumber.get(patientMedplumId) || "");
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
              type: "Transcription",
              title: obs.code?.text || "History item",
              date: obs.effectiveDateTime || "",
              summary:
                Array.isArray(obs.note) && obs.note[0]?.text
                  ? obs.note[0].text
                  : obs.valueString || "",
              audioData,
              audioUrl: audioData || "",
              audioMimeType: "",
            });
            historyByIdNumber.set(idNumber, list);
          });

          documentReferenceResources.forEach((dr) => {
            const ref = dr.subject?.reference || "";
            const match = ref.match(/^Patient\/(.+)$/);
            if (!match) return;

            const patientMedplumId = match[1];
            const idNumber = trimId(medplumIdToIdNumber.get(patientMedplumId) || "");
            if (!idNumber) return;

            const content = Array.isArray(dr.content) ? dr.content : [];
            const textAtt = content
              .map((c) => c?.attachment)
              .find((a) => a?.contentType?.startsWith("text/") && a?.data);
            const audioAtt = content
              .map((c) => c?.attachment)
              .find((a) => a?.contentType?.startsWith("audio/") && (a?.url || a?.data));

            const summary = textAtt?.data ? safeBase64ToText(textAtt.data) : "";
            const audioUrl = audioAtt?.url
              ? audioAtt.url
              : audioAtt?.data
              ? `data:${audioAtt.contentType || "audio/webm"};base64,${audioAtt.data}`
              : "";

            const identifiers = Array.isArray(dr.identifier) ? dr.identifier : [];
            const sessionId =
              identifiers.find((id) => id?.value)?.value || dr.id || crypto.randomUUID();

            const list = historyByIdNumber.get(idNumber) || [];
            list.push({
              id: sessionId,
              type: "Transcription",
              title: "Treatment session",
              date: dr.date || dr.meta?.lastUpdated || "",
              summary,
              audioUrl,
              audioData: audioUrl,
              audioMimeType: audioAtt?.contentType || "",
            });
            historyByIdNumber.set(idNumber, list);
          });

          const reportsByIdNumber = new Map();
          diagnosticResources.forEach((dr) => {
            const ref = dr.subject?.reference || "";
            const match = ref.match(/^Patient\/(.+)$/);
            if (!match) return;

            const patientMedplumId = match[1];
            const idNumber = trimId(medplumIdToIdNumber.get(patientMedplumId) || "");
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
    },
    [updatePatientsWithSave]
  );

  const handleSaveTranscription = useCallback(
    async (idNumber, transcriptionText, audioData) => {
      const trimmedId = trimId(idNumber);
      const cleanText = (transcriptionText || "").trim();
      const cleanAudio = audioData || null;

      if (!trimmedId) return;
      if (!cleanText && !cleanAudio) return;

      const now = new Date().toISOString();
      let updatedPatientRef = null;

      updatePatientsWithSave((prev) =>
        prev.map((p) => {
          if (trimId(p.idNumber) !== trimmedId) return p;

          const historyItem = {
            id: crypto.randomUUID(),
            type: "Transcription",
            title: "Treatment transcription",
            date: now,
            summary: cleanText || "Audio recording",
            audioData: cleanAudio,
            audioUrl: cleanAudio || "",
            audioMimeType: "",
          };

          const next = normalizePatient({
            ...p,
            history: [...ensureArray(p.history), historyItem],
            reports: ensureArray(p.reports),
          });

          updatedPatientRef = next;
          return next;
        })
      );

      // Optional sync only
      if (!hasMedplumSession()) return;
      if (!updatedPatientRef) return;

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
          code: { text: "Treatment transcription" },
          note: cleanText ? [{ text: cleanText }] : [],
        };

        const audioAttachment = extractAudioAttachment(cleanAudio);
        if (audioAttachment) {
          observation.extension = [
            {
              url: "https://medicalcare.local/extension/audioData",
              valueString: cleanAudio,
            },
          ];
        }

        await medplum.createResource(observation);
      } catch (error) {
        void error;
      }
    },
    [updatePatientsWithSave]
  );

  // Optional auto-sync (LOCAL never depends on it)
  const performFullSyncToMedplum = useCallback(
    async ({ silent = false } = {}) => {
      if (!hasMedplumSession()) {
        if (!silent) alert("Please sign in first.");
        return;
      }

      if (!Array.isArray(patients) || patients.length === 0) {
        if (!silent) alert("No local patients to sync.");
        return;
      }

      if (!silent) {
        const confirmSync = confirm(
          `This will sync ${patients.length} patients and all their data to Medplum.\n\nContinue?`
        );
        if (!confirmSync) return;
      }

      const updatedPatients = [...patients];

      for (let i = 0; i < updatedPatients.length; i += 1) {
=======

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

          updatePatientsWithSave((prev) => mergePatients(prev, arr));
          alert("Patients imported successfully!");
          return;
        }

        const resources = json.entry.map((entry) => entry.resource).filter(Boolean);

        const patientResources = resources.filter((res) => res.resourceType === "Patient");
        const observationResources = resources.filter((res) => res.resourceType === "Observation");
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

        updatedPatientRef = normalizePatient({
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
          prev.map((p) =>
            trimId(p.idNumber) === trimmedId ? { ...p, medplumId } : p
          )
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
      };

      const audioAttachment = extractAudioAttachment(cleanAudio);
      if (audioAttachment) {
        observation.extension = [
          {
            url: "https://medicalcare.local/extension/audioData",
            valueString: cleanAudio,
          },
        ];
      }

      await medplum.createResource(observation);
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
      `This will sync ${patients.length} patients and all their data to Medplum.\n\nContinue?`
    );
    if (!confirmSync) return;

    try {
      const updatedPatients = [...patients];

      let successCount = 0;
      let errorCount = 0;
      const errors = [];

      for (let i = 0; i < updatedPatients.length; i++) {
>>>>>>> refactor-ui-cleanup
        const p = updatedPatients[i];
        const idNumber = trimId(p.idNumber);
        if (!idNumber) continue;

        try {
<<<<<<< HEAD
          const medplumId =
            (await ensureMedplumPatient({ ...p, medplumId: null })) || p.medplumId;

          if (!medplumId) continue;

          updatedPatients[i] = { ...p, medplumId };
          const subjectRef = `Patient/${medplumId}`;

          const history = ensureArray(updatedPatients[i].history);
          for (let j = 0; j < history.length; j += 1) {
            const item = history[j];
            try {
              const obs = historyItemToObservation({ ...updatedPatients[i], medplumId }, item, j);
              obs.subject = { reference: subjectRef };
              await medplum.createResource(obs);
=======
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

          const history = ensureArray(updatedPatients[i].history);
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
>>>>>>> refactor-ui-cleanup

              if (item.audioData) {
                const attachment = extractAudioAttachment(item.audioData);
                if (attachment) {
                  const media = {
                    resourceType: "Media",
                    status: "completed",
                    subject: { reference: subjectRef },
                    createdDateTime: item.date || new Date().toISOString(),
                    content: {
                      contentType: attachment.contentType,
                      data: attachment.data,
                    },
                  };
                  await medplum.createResource(media);
                }
              }
<<<<<<< HEAD
            } catch (error) {
              void error;
            }
          }

          const reports = ensureArray(updatedPatients[i].reports);
          for (let k = 0; k < reports.length; k += 1) {
=======
            } catch {}
          }

          const reports = ensureArray(updatedPatients[i].reports);
          for (let k = 0; k < reports.length; k++) {
>>>>>>> refactor-ui-cleanup
            const rep = reports[k];
            try {
              const dr = reportToDiagnosticReport({ ...updatedPatients[i], medplumId }, rep, k);
              dr.subject = { reference: subjectRef };
              await medplum.createResource(dr);
<<<<<<< HEAD
            } catch (error) {
              void error;
            }
          }
        } catch (error) {
          void error;
        }
      }

      // Save any medplumId enrichments locally (still local source of truth)
      const changed = updatedPatients.some(
        (p, idx) => (patients[idx]?.medplumId || null) !== (p?.medplumId || null)
      );
      if (changed) updatePatientsWithSave(updatedPatients);
    },
    [patients, updatePatientsWithSave]
  );

  const handleSyncAllToMedplum = useCallback(async () => {
    await performFullSyncToMedplum({ silent: false });
  }, [performFullSyncToMedplum]);

  useEffect(() => {
    if (!hydrated) return;
    if (!storageLoaded) return;
    if (!hasMedplumSession()) return;
    if (didAutoSyncRef.current) return;
    if (!Array.isArray(patients) || patients.length === 0) return;

    didAutoSyncRef.current = true;

    const t = setTimeout(() => {
      performFullSyncToMedplum({ silent: true });
    }, 0);

    return () => clearTimeout(t);
  }, [hydrated, storageLoaded, patients, performFullSyncToMedplum]);
=======
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
>>>>>>> refactor-ui-cleanup

  return {
    patients,
    selectedPatient,
    selectedPatientFullName,
    editingPatient,
<<<<<<< HEAD
=======

>>>>>>> refactor-ui-cleanup
    handleCreatePatient,
    handleAddPatient: handleCreatePatient,
    handleUpdatePatient,
    handleUpdatePatientInline,
    handleCancelEdit,
    handleEditPatient,
<<<<<<< HEAD
    handleDeletePatient,
    handleSelectPatient,
    handleAddReport,
    handleDeleteReport,
=======

    handleDeletePatient,
    handleSelectPatient,

    handleAddReport,
    handleDeleteReport,

>>>>>>> refactor-ui-cleanup
    handleExportPatients,
    handleImportPatients,
    handleSaveTranscription,
    handleSyncAllToMedplum,
  };
}
