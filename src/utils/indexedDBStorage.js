// src/utils/indexedDBStorage.js

const DB_NAME = "MedicalCareDB";
const DB_VERSION = 1;
const STORE_PATIENTS = "patients";
const STORE_MEDIA = "media"; // For large files (audio, PDFs)

let dbInstance = null;

/**
 * Initialize IndexedDB database
 */
function initDB() {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !window.indexedDB) {
      reject(new Error("IndexedDB is not available"));
      return;
    }

    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error("[IndexedDB] Failed to open database:", request.error);
      reject(request.error);
    };

    request.onsuccess = () => {
      dbInstance = request.result;
      if (import.meta.env.DEV) {
        console.log("[IndexedDB] Database opened successfully");
      }
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;

      // Create patients store
      if (!db.objectStoreNames.contains(STORE_PATIENTS)) {
        const patientStore = db.createObjectStore(STORE_PATIENTS, {
          keyPath: "idNumber",
        });
        patientStore.createIndex("medplumId", "medplumId", { unique: false });
        if (import.meta.env.DEV) {
          console.log("[IndexedDB] Created patients store");
        }
      }

      // Create media store for large files
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        const mediaStore = db.createObjectStore(STORE_MEDIA, {
          keyPath: "id",
        });
        mediaStore.createIndex("patientId", "patientId", { unique: false });
        mediaStore.createIndex("type", "type", { unique: false });
        if (import.meta.env.DEV) {
          console.log("[IndexedDB] Created media store");
        }
      }
    };
  });
}

/**
 * Check if IndexedDB is available
 */
export function isIndexedDBAvailable() {
  return typeof window !== "undefined" && window.indexedDB !== undefined;
}

/**
 * Get database instance
 */
async function getDB() {
  if (!isIndexedDBAvailable()) {
    throw new Error("IndexedDB is not available");
  }
  if (!dbInstance) {
    await initDB();
  }
  return dbInstance;
}

/**
 * Save all patients to IndexedDB
 */
export async function savePatientsToIndexedDB(patients) {
  if (!isIndexedDBAvailable()) {
    return false;
  }

  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_PATIENTS], "readwrite");
    const store = transaction.objectStore(STORE_PATIENTS);

    // Clear existing data
    await store.clear();

    // Save all patients
    const promises = patients.map((patient) => {
      // Store metadata in IndexedDB, but keep references to media
      const patientData = {
        ...patient,
        // Don't store large media in main store - use separate media store
        history: patient.history?.map((item) => ({
          ...item,
          audioData: item.audioData ? `media:${item.id}` : null,
        })),
        reports: patient.reports?.map((report) => ({
          ...report,
          fileData: report.fileData ? `media:${report.id}` : null,
        })),
      };
      return store.put(patientData);
    });

    await Promise.all(promises);

    // Save media files separately
    for (const patient of patients) {
      // Save audio files
      if (patient.history) {
        for (const item of patient.history) {
          if (item.audioData && !item.audioData.startsWith("media:")) {
            await saveMediaToIndexedDB({
              id: `audio-${item.id}`,
              patientId: patient.idNumber,
              type: "audio",
              data: item.audioData,
            });
          }
        }
      }

      // Save PDF files
      if (patient.reports) {
        for (const report of patient.reports) {
          if (report.fileData && !report.fileData.startsWith("media:")) {
            await saveMediaToIndexedDB({
              id: `pdf-${report.id}`,
              patientId: patient.idNumber,
              type: "pdf",
              data: report.fileData,
            });
          }
        }
      }
    }

    if (import.meta.env.DEV) {
      console.log(
        `[IndexedDB] Saved ${patients.length} patients to IndexedDB`
      );
    }
    return true;
  } catch (error) {
    console.error("[IndexedDB] Failed to save patients:", error);
    return false;
  }
}

/**
 * Load all patients from IndexedDB
 */
export async function loadPatientsFromIndexedDB() {
  if (!isIndexedDBAvailable()) {
    return [];
  }

  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_PATIENTS], "readonly");
    const store = transaction.objectStore(STORE_PATIENTS);
    const request = store.getAll();

    return new Promise((resolve, reject) => {
      request.onsuccess = async () => {
        const patients = request.result || [];

        // Restore media files
        for (const patient of patients) {
          // Restore audio files
          if (patient.history) {
            for (const item of patient.history) {
              if (item.audioData) {
                // Check if it's a media reference (stored separately in IndexedDB)
                if (item.audioData.startsWith("media:")) {
                  const mediaId = item.audioData.replace("media:", "");
                  const audioData = await loadMediaFromIndexedDB(mediaId);
                  if (audioData && audioData.data) {
                    item.audioData = audioData.data;
                    if (import.meta.env.DEV) {
                      console.log(`[IndexedDB] Restored audio for history item ${item.id}`);
                    }
                  } else {
                    // If media not found, try to load with audio- prefix
                    const audioId = `audio-${item.id}`;
                    const audioDataAlt = await loadMediaFromIndexedDB(audioId);
                    if (audioDataAlt && audioDataAlt.data) {
                      item.audioData = audioDataAlt.data;
                      if (import.meta.env.DEV) {
                        console.log(`[IndexedDB] Restored audio for history item ${item.id} using alt ID`);
                      }
                    } else {
                      if (import.meta.env.DEV) {
                        console.warn(`[IndexedDB] Could not restore audio for history item ${item.id}`);
                      }
                    }
                  }
                } else if (!item.audioData.startsWith("data:")) {
                  // If audioData exists but is not a data URL, it might be corrupted
                  // Try to find it in media store
                  const audioId = `audio-${item.id}`;
                  const audioData = await loadMediaFromIndexedDB(audioId);
                  if (audioData && audioData.data) {
                    // Ensure it's a proper data URL
                    if (audioData.data.startsWith("data:")) {
                      item.audioData = audioData.data;
                    } else {
                      // Construct data URL if it's just base64
                      item.audioData = `data:audio/webm;base64,${audioData.data}`;
                    }
                    if (import.meta.env.DEV) {
                      console.log(`[IndexedDB] Restored audio for history item ${item.id} from media store`);
                    }
                  } else {
                    // If still not found, try to construct data URL from the existing value
                    if (item.audioData && item.audioData.length > 50) {
                      item.audioData = `data:audio/webm;base64,${item.audioData}`;
                      if (import.meta.env.DEV) {
                        console.log(`[IndexedDB] Constructed data URL for history item ${item.id}`);
                      }
                    }
                  }
                }
                // If it's already a data URL, keep it as is
              }
            }
          }

          // Restore PDF files
          if (patient.reports) {
            for (const report of patient.reports) {
              if (report.fileData && report.fileData.startsWith("media:")) {
                const mediaId = report.fileData.replace("media:", "");
                const pdfData = await loadMediaFromIndexedDB(mediaId);
                if (pdfData) {
                  report.fileData = pdfData.data;
                }
              }
            }
          }
        }

        if (import.meta.env.DEV) {
          console.log(
            `[IndexedDB] Loaded ${patients.length} patients from IndexedDB`
          );
        }
        resolve(patients);
      };

      request.onerror = () => {
        console.error("[IndexedDB] Failed to load patients:", request.error);
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("[IndexedDB] Failed to load patients:", error);
    return [];
  }
}

/**
 * Save media file (audio/PDF) to IndexedDB
 */
async function saveMediaToIndexedDB(mediaItem) {
  if (!isIndexedDBAvailable()) {
    return false;
  }

  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_MEDIA], "readwrite");
    const store = transaction.objectStore(STORE_MEDIA);
    await store.put(mediaItem);
    return true;
  } catch (error) {
    console.error("[IndexedDB] Failed to save media:", error);
    return false;
  }
}

/**
 * Load media file from IndexedDB
 */
async function loadMediaFromIndexedDB(mediaId) {
  if (!isIndexedDBAvailable()) {
    return null;
  }

  try {
    const db = await getDB();
    const transaction = db.transaction([STORE_MEDIA], "readonly");
    const store = transaction.objectStore(STORE_MEDIA);
    const request = store.get(mediaId);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.error("[IndexedDB] Failed to load media:", error);
    return null;
  }
}

/**
 * Get storage usage estimate
 */
export async function getStorageUsage() {
  if (!isIndexedDBAvailable()) {
    return { available: false, estimate: 0 };
  }

  try {
    await getDB(); // Initialize DB if needed
    const patients = await loadPatientsFromIndexedDB();
    
    // Rough estimate: count characters in JSON
    const jsonSize = JSON.stringify(patients).length;
    const estimateMB = (jsonSize / (1024 * 1024)).toFixed(2);

    return {
      available: true,
      estimate: parseFloat(estimateMB),
      patientCount: patients.length,
    };
  } catch (error) {
    console.error("[IndexedDB] Failed to estimate storage:", error);
    return { available: false, estimate: 0 };
  }
}

/**
 * Clear all data from IndexedDB
 */
export async function clearIndexedDB() {
  if (!isIndexedDBAvailable()) {
    return false;
  }

  try {
    const db = await getDB();
    const transaction = db.transaction(
      [STORE_PATIENTS, STORE_MEDIA],
      "readwrite"
    );
    
    await transaction.objectStore(STORE_PATIENTS).clear();
    await transaction.objectStore(STORE_MEDIA).clear();
    
    if (import.meta.env.DEV) {
      console.log("[IndexedDB] Cleared all data");
    }
    return true;
  } catch (error) {
    console.error("[IndexedDB] Failed to clear data:", error);
    return false;
  }
}

/*
 * FILE DOCUMENTATION: src/utils/indexedDBStorage.js
 * 
 * IndexedDB storage utility for handling large amounts of patient data.
 * Provides scalable storage solution that can handle many patients with
 * audio recordings and PDF reports.
 * 
 * KEY FEATURES:
 * - Separate storage for patient metadata and large media files
 * - Automatic media file management (audio, PDFs)
 * - Storage usage estimation
 * - Fallback to localStorage if IndexedDB unavailable
 * 
 * FUNCTIONS:
 * 
 * 1. isIndexedDBAvailable():
 *    - Checks if IndexedDB is supported in the browser
 *    - Returns boolean
 * 
 * 2. savePatientsToIndexedDB(patients):
 *    - Saves all patients to IndexedDB
 *    - Separates large media files into separate store
 *    - Returns boolean indicating success
 * 
 * 3. loadPatientsFromIndexedDB():
 *    - Loads all patients from IndexedDB
 *    - Automatically restores media files
 *    - Returns array of patients
 * 
 * 4. getStorageUsage():
 *    - Estimates current storage usage
 *    - Returns object with estimate in MB and patient count
 * 
 * 5. clearIndexedDB():
 *    - Clears all data from IndexedDB
 *    - Useful for testing or data reset
 * 
 * STORAGE STRUCTURE:
 * - patients store: Patient metadata and references to media
 * - media store: Large files (audio recordings, PDF reports)
 * 
 * STORAGE LIMITS:
 * - IndexedDB: Typically 50% of available disk space (much larger than localStorage)
 * - localStorage: ~5-10MB limit
 * 
 * MIGRATION:
 * - Automatically migrates from localStorage on first use
 * - Maintains backward compatibility
 */

