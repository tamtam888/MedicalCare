// src/utils/indexedDBStorage.js
export function isIndexedDBAvailable() {
  if (typeof window === "undefined") {
    return false;
  }

  try {
    const indexedDB =
      window.indexedDB ||
      window.mozIndexedDB ||
      window.webkitIndexedDB ||
      window.msIndexedDB;

    return Boolean(indexedDB);
  } catch {
    return false;
  }
}
