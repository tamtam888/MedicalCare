// src/utils/patientStorage.js

const STORAGE_KEY = "patients";
const BACKUP_KEYS = [
  "patientsBackup",
  "patients:backup",
  "patients_backup",
  "patients:main",
  "patients_main",
];

const isDev = import.meta.env.DEV;

function safeParseArray(raw, label) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (isDev) console.warn(`[patientStorage] ${label} is not an array, ignoring`, parsed);
    return null;
  } catch (e) {
    if (isDev) console.warn(`[patientStorage] Failed to parse ${label}, ignoring`, e);
    return null;
  }
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function normalizeHistory(history) {
  if (!history) return [];
  if (Array.isArray(history)) return history.filter(Boolean);
  if (typeof history === "object") return Object.values(history).filter(Boolean);
  return [];
}

function normalizePatient(p) {
  if (!p || typeof p !== "object") return null;
  return {
    ...p,
    history: normalizeHistory(p.history),
    reports: ensureArray(p.reports).filter(Boolean),
  };
}

function normalizePatients(patients) {
  if (!Array.isArray(patients)) return [];
  return patients.map(normalizePatient).filter(Boolean);
}

function writeAll(patients) {
  const safe = normalizePatients(patients);
  const json = JSON.stringify(safe);

  window.localStorage.setItem(STORAGE_KEY, json);

  window.localStorage.setItem("patients:backup", json);
  window.localStorage.setItem("patients_backup", json);
  window.localStorage.setItem("patientsBackup", json);
  window.localStorage.setItem("patients:main", json);
  window.localStorage.setItem("patients_main", json);

  if (isDev) console.log("[patientStorage] Saved patients:", safe.length);
}

export function loadPatientsFromStorage() {
  try {
    if (typeof window === "undefined") return [];

    const primary = safeParseArray(window.localStorage.getItem(STORAGE_KEY), STORAGE_KEY);
    if (primary) return normalizePatients(primary);

    for (const key of BACKUP_KEYS) {
      const arr = safeParseArray(window.localStorage.getItem(key), key);
      if (arr) {
        const normalized = normalizePatients(arr);
        try {
          writeAll(normalized);
          if (isDev) console.log(`[patientStorage] Migrated from ${key} -> ${STORAGE_KEY}`);
        } catch {}
        return normalized;
      }
    }

    return [];
  } catch (error) {
    console.error("[patientStorage] Failed to load patients", error);
    return [];
  }
}

export function savePatientsToStorage(patients) {
  try {
    if (typeof window === "undefined") return;
    writeAll(patients);
  } catch (error) {
    console.error("[patientStorage] Failed to save patients", error);
  }
}
