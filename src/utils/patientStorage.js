// src/utils/patientStorage.js

const STORAGE_KEY = "patients";
const BACKUP_KEY = "patientsBackup";

const isDevelopment = import.meta.env.DEV;

/**
 * טוען מטופלים מהדפדפן.
 * - אם יש נתונים תקינים במפתח הראשי - מחזירים אותם.
 * - אם הראשי ריק אבל יש גיבוי - מחזירים מהגיבוי.
 * - אם אין כלום או שיש שגיאה - מחזירים [].
 */
export function loadPatientsFromStorage() {
  try {
    if (typeof window === "undefined") {
      if (isDevelopment) {
        console.warn("[patientStorage] window is undefined, returning []");
      }
      return [];
    }

    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (isDevelopment) {
          console.log(
            "[patientStorage] Loaded patients from STORAGE_KEY:",
            parsed.length
          );
        }
        return parsed;
      } else {
        if (isDevelopment) {
          console.warn(
            "[patientStorage] Data in STORAGE_KEY is not an array, ignoring",
            parsed
          );
        }
      }
    }

    const rawBackup = window.localStorage.getItem(BACKUP_KEY);
    if (rawBackup) {
      const parsedBackup = JSON.parse(rawBackup);
      if (Array.isArray(parsedBackup)) {
        if (isDevelopment) {
          console.log(
            "[patientStorage] Loaded patients from BACKUP_KEY:",
            parsedBackup.length
          );
        }
        return parsedBackup;
      } else {
        if (isDevelopment) {
          console.warn(
            "[patientStorage] Data in BACKUP_KEY is not an array, ignoring",
            parsedBackup
          );
        }
      }
    }

    return [];
  } catch (error) {
    console.error("[patientStorage] Failed to load patients from storage", error);
    return [];
  }
}

/**
 * שומר מטופלים בדפדפן.
 * - תמיד שומר גם במפתח הראשי וגם בגיבוי.
 */
export function savePatientsToStorage(patients) {
  try {
    if (typeof window === "undefined") {
      if (isDevelopment) {
        console.warn("[patientStorage] window is undefined, skipping save");
      }
      return;
    }

    const safe = Array.isArray(patients) ? patients : [];
    const json = JSON.stringify(safe);

    window.localStorage.setItem(STORAGE_KEY, json);
    window.localStorage.setItem(BACKUP_KEY, json);

    if (isDevelopment) {
      console.log(
        "[patientStorage] Saved patients to storage:",
        safe.length
      );
    }
  } catch (error) {
    console.error("[patientStorage] Failed to save patients to storage", error);
  }
}
