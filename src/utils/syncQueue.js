// src/utils/syncQueue.js
const STORAGE_KEY = "syncQueue";

/** Load the queue from localStorage */
export function loadQueue() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** Replace the queue entirely */
export function replaceQueue(queue) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.warn("[syncQueue] Failed to save:", e);
  }
}

/** Add a job to the queue */
export function enqueue(job) {
  const queue = loadQueue();
  queue.push({
    ...job,
    createdAt: new Date().toISOString(),
  });
  replaceQueue(queue);
  if (import.meta.env.DEV) {
    console.log(`[syncQueue] Added job: ${job.type}`, job);
  }
}
