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

function toMs(value) {
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? t : NaN;
}

function overlaps(aStart, aEnd, bStart, bEnd) {
  const s1 = toMs(aStart);
  const e1 = toMs(aEnd);
  const s2 = toMs(bStart);
  const e2 = toMs(bEnd);

  if (![s1, e1, s2, e2].every(Number.isFinite)) return false;
  if (e1 <= s1 || e2 <= s2) return false;

  return s2 < e1 && e2 > s1;
}

function hasTherapistConflict(allAppointments, candidate, ignoreId = null) {
  const therapistId = String(candidate?.therapistId || "").trim();
  if (!therapistId) return false;

  return (allAppointments || []).some((a) => {
    if (!a) return false;
    if (ignoreId && String(a.id) === String(ignoreId)) return false;
    if (String(a.therapistId || "").trim() !== therapistId) return false;

    return overlaps(a.start, a.end, candidate.start, candidate.end);
  });
}

function assertNoConflict(allAppointments, candidate, ignoreId = null) {
  if (hasTherapistConflict(allAppointments, candidate, ignoreId)) {
    const err = new Error("This time is not available for the selected therapist (double booking).");
    err.code = "APPOINTMENT_CONFLICT";
    throw err;
  }
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

  assertNoConflict(existing, {
    therapistId: appointment.therapistId,
    start: appointment.start,
    end: appointment.end,
  });

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

  const current = existing.find((a) => a.id === id) || null;
  if (!current) return null;

  const normalizedPatch = normalizeAppointmentPatch(patch);

  const candidate = {
    ...current,
    ...normalizedPatch,
    updatedAt: now,
  };

  assertNoConflict(existing, {
    therapistId: candidate.therapistId,
    start: candidate.start,
    end: candidate.end,
  }, id);

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
