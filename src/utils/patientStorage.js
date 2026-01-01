// src/utils/patientStorage.js

const STORAGE_KEY = "patients";
const BACKUP_KEY = `${STORAGE_KEY}_backup`; // patients_backup

const LEGACY_KEYS = [
  "patients:main",
  "patients:backup",
  "patientsBackup",
  "patients_main",
  "patients_backup",
  STORAGE_KEY,
  BACKUP_KEY,
];

const isDev = Boolean(import.meta?.env?.DEV);

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

  // Primary keys (what usePatients.js expects)
  window.localStorage.setItem(STORAGE_KEY, json);
  window.localStorage.setItem(BACKUP_KEY, json);

  // Legacy keys (keep compatibility)
  window.localStorage.setItem("patients:main", json);
  window.localStorage.setItem("patients:backup", json);
  window.localStorage.setItem("patientsBackup", json);
  window.localStorage.setItem("patients_main", json);
  window.localStorage.setItem("patients_backup", json);

  if (isDev) console.log("[patientStorage] Saved patients:", safe.length);
}

export function loadPatientsFromStorage() {
  try {
    if (typeof window === "undefined") return [];

    // 1) Try primary key first
    const primary = safeParseArray(window.localStorage.getItem(STORAGE_KEY), STORAGE_KEY);
    if (primary && primary.length > 0) return normalizePatients(primary);

    // 2) Try the backup key used by usePatients.js
    const backup = safeParseArray(window.localStorage.getItem(BACKUP_KEY), BACKUP_KEY);
    if (backup && backup.length > 0) return normalizePatients(backup);

    // 3) Try legacy keys
    for (const key of LEGACY_KEYS) {
      const arr = safeParseArray(window.localStorage.getItem(key), key);
      if (arr && arr.length > 0) {
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

/**
 * Auto-migration on module load:
 * If usePatients.js loads from "patients" but data exists only in "patients:main",
 * we populate "patients" and "patients_backup" immediately.
 */
(function autoMigrateOnLoad() {
  try {
    if (typeof window === "undefined") return;

    const hasPrimary = Boolean(window.localStorage.getItem(STORAGE_KEY));
    const hasBackup = Boolean(window.localStorage.getItem(BACKUP_KEY));
    if (hasPrimary || hasBackup) return;

    const legacy = safeParseArray(window.localStorage.getItem("patients:main"), "patients:main")
      || safeParseArray(window.localStorage.getItem("patients:backup"), "patients:backup")
      || safeParseArray(window.localStorage.getItem("patientsBackup"), "patientsBackup")
      || safeParseArray(window.localStorage.getItem("patients_main"), "patients_main")
      || safeParseArray(window.localStorage.getItem("patients_backup"), "patients_backup");

    if (!legacy || legacy.length === 0) return;

    const normalized = normalizePatients(legacy);
    writeAll(normalized);

    if (isDev) console.log("[patientStorage] Auto-migrated legacy storage -> patients");
  } catch (e) {
    if (isDev) console.warn("[patientStorage] Auto-migration failed", e);
  }
})();
