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
  let arr = [];
  if (!history) arr = [];
  else if (Array.isArray(history)) arr = history.filter(Boolean);
  else if (typeof history === "object") arr = Object.values(history).filter(Boolean);

  arr.sort((a, b) => {
    const da = Date.parse(a?.date || "") || 0;
    const db = Date.parse(b?.date || "") || 0;
    return db - da;
  });

  return arr;
}

function normalizeExercises(exercises) {
  if (!exercises) return [];
  if (Array.isArray(exercises)) return exercises.filter(Boolean);
  if (typeof exercises === "object") return Object.values(exercises).filter(Boolean);
  return [];
}

function normalizeGoals(goals) {
  if (!goals) return [];
  if (Array.isArray(goals)) return goals.filter(Boolean);
  if (typeof goals === "object") return Object.values(goals).filter(Boolean);
  return [];
}

function normalizeCarePlan(cp) {
  if (!cp || typeof cp !== "object") return null;
  return {
    ...cp,
    goals: normalizeGoals(cp.goals),
    exercises: normalizeExercises(cp.exercises),
  };
}

function normalizeCarePlanDraft(cp) {
  return normalizeCarePlan(cp);
}

function normalizeCarePlans(carePlans) {
  if (!carePlans) return [];
  if (Array.isArray(carePlans)) return carePlans.map(normalizeCarePlan).filter(Boolean);
  if (typeof carePlans === "object") {
    return Object.values(carePlans).map(normalizeCarePlan).filter(Boolean);
  }
  return [];
}

function normalizePatient(p) {
  if (!p || typeof p !== "object") return null;

  const legacyHistory =
    p.history ??
    p.historyItems ??
    p.patientHistory ??
    p.timeline ??
    null;

  const legacyReports =
    p.reports ??
    p.medicalReports ??
    p.files ??
    null;

  return {
    ...p,
    history: normalizeHistory(legacyHistory),
    reports: ensureArray(legacyReports).filter(Boolean),
    carePlanDraft: normalizeCarePlanDraft(p.carePlanDraft),
    carePlans: normalizeCarePlans(p.carePlans),
  };
}

function normalizePatients(patients) {
  if (!Array.isArray(patients)) return [];
  return patients.map(normalizePatient).filter(Boolean);
}

function getExistingCount() {
  const primary = safeParseArray(window.localStorage.getItem(STORAGE_KEY), STORAGE_KEY);
  if (primary && primary.length > 0) return primary.length;

  for (const key of BACKUP_KEYS) {
    const arr = safeParseArray(window.localStorage.getItem(key), key);
    if (arr && arr.length > 0) return arr.length;
  }

  return 0;
}

function writeAll(patients, options = {}) {
  const { allowEmptySave = false, updateBackups = true } = options;

  const safe = normalizePatients(patients);
  const existingCount = getExistingCount();

  if (!allowEmptySave && existingCount > 0 && safe.length === 0) {
    if (isDev) console.warn("[patientStorage] Prevented empty save");
    return;
  }

  const json = JSON.stringify(safe);
  window.localStorage.setItem(STORAGE_KEY, json);

  if (updateBackups && (safe.length > 0 || allowEmptySave)) {
    window.localStorage.setItem("patients:backup", json);
    window.localStorage.setItem("patients_backup", json);
    window.localStorage.setItem("patientsBackup", json);
    window.localStorage.setItem("patients:main", json);
    window.localStorage.setItem("patients_main", json);
  }

  if (isDev) console.log("[patientStorage] Saved patients:", safe.length);
}

export function loadPatientsFromStorage() {
  try {
    if (typeof window === "undefined") return [];

    const primary = safeParseArray(window.localStorage.getItem(STORAGE_KEY), STORAGE_KEY);
    if (primary && primary.length > 0) return normalizePatients(primary);

    for (const key of BACKUP_KEYS) {
      const arr = safeParseArray(window.localStorage.getItem(key), key);
      if (arr && arr.length > 0) {
        const normalized = normalizePatients(arr);
        try {
          writeAll(normalized, { allowEmptySave: false, updateBackups: true });
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

export function savePatientsToStorage(patients, options = {}) {
  try {
    if (typeof window === "undefined") return;
    writeAll(patients, {
      allowEmptySave: Boolean(options.allowEmptySave),
      updateBackups: options.updateBackups !== false,
    });
  } catch (error) {
    console.error("[patientStorage] Failed to save patients", error);
  }
}
