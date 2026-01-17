import { get, set, del } from "idb-keyval";
import { appointmentSchema, buildAppointment } from "./appointmentSchema";

const APPOINTMENTS_KEY = "mc_appointments_v1";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function sortByStartAsc(a, b) {
  return new Date(a.start).getTime() - new Date(b.start).getTime();
}

function normalize(value) {
  return String(value ?? "").trim();
}

function digitsOnly(value) {
  return normalize(value).replace(/\D/g, "");
}

function normalizeAppointmentInput(input) {
  return {
    ...input,
    patientId: digitsOnly(input?.patientId),
    therapistId: normalize(input?.therapistId),
  };
}

function normalizeAppointmentPatch(patch) {
  const next = { ...patch };

  if (Object.prototype.hasOwnProperty.call(next, "patientId")) {
    next.patientId = digitsOnly(next.patientId);
  }
  if (Object.prototype.hasOwnProperty.call(next, "therapistId")) {
    next.therapistId = normalize(next.therapistId);
  }

  return next;
}

export async function getAllAppointments() {
  const raw = await get(APPOINTMENTS_KEY);
  const list = safeArray(raw);

  const parsed = [];
  for (const item of list) {
    try {
      const validated = appointmentSchema.parse(item);
      parsed.push(validated);
    } catch {
      // Skip invalid records
    }
  }

  return parsed.sort(sortByStartAsc);
}

export async function setAllAppointments(appointments) {
  const validated = appointments.map((a) => appointmentSchema.parse(a));
  await set(APPOINTMENTS_KEY, validated);
  return validated.sort(sortByStartAsc);
}

export async function clearAppointments() {
  await del(APPOINTMENTS_KEY);
}

export async function createAppointment(input) {
  const normalizedInput = normalizeAppointmentInput(input);
  const appointment = buildAppointment(normalizedInput);

  const existing = await getAllAppointments();
  const next = [
    ...existing,
    {
      ...appointment,
      pendingSync: true,
      syncError: null,
    },
  ];

  await set(APPOINTMENTS_KEY, next);
  return appointment;
}

export async function updateAppointment(id, patch) {
  const existing = await getAllAppointments();
  const now = new Date().toISOString();

  const normalizedPatch = normalizeAppointmentPatch(patch);

  const next = existing.map((a) => {
    if (a.id !== id) return a;

    const merged = {
      ...a,
      ...normalizedPatch,
      updatedAt: now,
      pendingSync: true,
      syncError: null,
    };

    return appointmentSchema.parse(merged);
  });

  await set(APPOINTMENTS_KEY, next);
  return next.find((a) => a.id === id) || null;
}

export async function deleteAppointment(id) {
  const existing = await getAllAppointments();
  const next = existing.filter((a) => a.id !== id);
  await set(APPOINTMENTS_KEY, next);
  return true;
}

export async function getPendingSyncAppointments() {
  const all = await getAllAppointments();
  return all.filter((a) => a.pendingSync === true);
}

export async function markAppointmentSynced(id) {
  const existing = await getAllAppointments();

  const next = existing.map((a) => {
    if (a.id !== id) return a;
    return {
      ...a,
      pendingSync: false,
      syncError: null,
      updatedAt: new Date().toISOString(),
    };
  });

  await set(APPOINTMENTS_KEY, next);
  return next.find((a) => a.id === id) || null;
}

export async function markAppointmentSyncError(id, message) {
  const existing = await getAllAppointments();

  const next = existing.map((a) => {
    if (a.id !== id) return a;
    return {
      ...a,
      pendingSync: true,
      syncError: String(message || "Sync failed"),
      updatedAt: new Date().toISOString(),
    };
  });

  await set(APPOINTMENTS_KEY, next);
  return next.find((a) => a.id === id) || null;
}
