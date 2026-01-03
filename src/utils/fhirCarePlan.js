// src/utils/fhirCarePlan.js
import { ID_SYSTEM, normalizePatient, trimId } from "./fhirPatient.js";
import { parseFlexibleDate, toISODateInput } from "./dateFormat.js";

const EXT_BASE = "https://medicalcare.local/fhir/StructureDefinition";
export const EXT_EXERCISE_SETS = `${EXT_BASE}/exercise-sets`;
export const EXT_EXERCISE_REPS = `${EXT_BASE}/exercise-reps`;
export const EXT_EXERCISE_DURATION_MIN = `${EXT_BASE}/exercise-duration-min`;

function uuid() {
  const id = globalThis.crypto?.randomUUID?.();
  return id || `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function ensureIsoDateOnly(value) {
  if (!value) return "";
  const d = parseFlexibleDate(value);
  if (!d) return "";
  return toISODateInput(d);
}

function mapGoalStatusToFhir(status) {
  const s = String(status || "").trim().toLowerCase();
  if (s === "planned") return "planned";
  if (s === "in progress" || s === "in-progress" || s === "active") return "active";
  if (s === "achieved" || s === "completed") return "completed";
  if (s === "on hold" || s === "on-hold" || s === "hold") return "on-hold";
  return "planned";
}

function makePatientRef(patient, patientFullUrl) {
  const p = normalizePatient(patient);
  const medplumId = trimId(p.medplumId);
  if (medplumId) return { reference: `Patient/${medplumId}` };
  return { reference: patientFullUrl };
}

function extInt(url, v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return { url, valueInteger: Math.trunc(n) };
}

export function toFhirGoal(goal, patientRef, goalFullUrl, carePlanRef) {
  const title = String(goal?.title || "").trim();
  const dueDate = ensureIsoDateOnly(goal?.targetDate);

  const resource = {
    resourceType: "Goal",
    lifecycleStatus: mapGoalStatusToFhir(goal?.status),
    description: { text: title || "Goal" },
    subject: patientRef,
    target: dueDate ? [{ dueDate }] : undefined,
    note: goal?.notes ? [{ text: String(goal.notes) }] : undefined,
    addresses: carePlanRef ? [{ reference: carePlanRef }] : undefined,
  };

  return { fullUrl: goalFullUrl, resource };
}

export function toFhirExercise(exercise, patientRef, exerciseFullUrl, carePlanRef) {
  const name = String(exercise?.name || "").trim();
  const instructions = String(exercise?.instructions || "").trim();
  const frequency = String(exercise?.frequency || "").trim();

  const extensions = [
    extInt(EXT_EXERCISE_SETS, exercise?.sets),
    extInt(EXT_EXERCISE_REPS, exercise?.reps),
    extInt(EXT_EXERCISE_DURATION_MIN, exercise?.durationMin),
  ].filter(Boolean);

  const noteLines = [];
  if (instructions) noteLines.push(instructions);
  if (frequency) noteLines.push(`Frequency: ${frequency}`);

  const resource = {
    resourceType: "ServiceRequest",
    status: "active",
    intent: "plan",
    subject: patientRef,
    basedOn: carePlanRef ? [{ reference: carePlanRef }] : undefined,
    code: { text: name || "Exercise" },
    note: noteLines.length ? [{ text: noteLines.join("\n") }] : undefined,
    extension: extensions.length ? extensions : undefined,
  };

  return { fullUrl: exerciseFullUrl, resource };
}

export function toFhirCarePlanBundle({ patient, carePlanDraft, includePatient = true } = {}) {
  const p = normalizePatient(patient);

  const patientIdNumber = trimId(p.idNumber);
  const patientFullUrl = `urn:uuid:patient-${uuid()}`;

  const patientEntry = includePatient
    ? {
        fullUrl: patientFullUrl,
        resource: {
          resourceType: "Patient",
          identifier: patientIdNumber ? [{ system: ID_SYSTEM, value: patientIdNumber }] : undefined,
          name: [
            {
              family: p.lastName || undefined,
              given: p.firstName ? [p.firstName] : undefined,
            },
          ],
          gender: p.gender ? String(p.gender).toLowerCase() : undefined,
          birthDate: p.dob || undefined,
          address:
            p.street || p.city || p.zipCode
              ? [
                  {
                    line: p.street ? [p.street] : undefined,
                    city: p.city || undefined,
                    postalCode: p.zipCode || undefined,
                  },
                ]
              : undefined,
        },
      }
    : null;

  const patientRef = makePatientRef(p, patientFullUrl);

  const goals = Array.isArray(carePlanDraft?.goals) ? carePlanDraft.goals : [];
  const exercises = Array.isArray(carePlanDraft?.exercises) ? carePlanDraft.exercises : [];

  const carePlanFullUrl = `urn:uuid:careplan-${uuid()}`;
  const carePlanRef = carePlanFullUrl;

  const lastUpdated =
    carePlanDraft?.lastUpdated ||
    carePlanDraft?.updatedAt ||
    carePlanDraft?.periodStart ||
    new Date().toISOString();

  const goalEntries = goals.map((g) => {
    const goalFullUrl = `urn:uuid:goal-${uuid()}`;
    return toFhirGoal(g, patientRef, goalFullUrl, carePlanRef);
  });

  const exerciseEntries = exercises.map((ex) => {
    const exerciseFullUrl = `urn:uuid:ex-${uuid()}`;
    return toFhirExercise(ex, patientRef, exerciseFullUrl, carePlanRef);
  });

  const carePlanResource = {
    resourceType: "CarePlan",
    status: "draft",
    intent: "plan",
    subject: patientRef,
    period: { start: String(lastUpdated) },
    meta: { lastUpdated: String(lastUpdated) },
    goal: goalEntries.map((e) => ({ reference: e.fullUrl })),
    activity: exerciseEntries.map((e) => ({ reference: { reference: e.fullUrl } })),
  };

  const entries = [];
  if (patientEntry) entries.push(patientEntry);
  entries.push(...goalEntries);
  entries.push(...exerciseEntries);
  entries.push({ fullUrl: carePlanFullUrl, resource: carePlanResource });

  return {
    resourceType: "Bundle",
    type: "collection",
    entry: entries,
  };
}
