import { z } from "zod";

export const AppointmentStatus = {
  scheduled: "scheduled",
  completed: "completed",
  cancelled: "cancelled",
};

/* Base schema – no refinements */
const appointmentBaseSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  therapistId: z.string().min(1, "Therapist is required"),
  start: z.string().datetime({ message: "Start must be a valid ISO datetime" }),
  end: z.string().datetime({ message: "End must be a valid ISO datetime" }),
  status: z.enum([
    AppointmentStatus.scheduled,
    AppointmentStatus.completed,
    AppointmentStatus.cancelled,
  ]),
  notes: z
    .string()
    .max(2000, "Notes is too long")
    .optional()
    .transform((v) => (typeof v === "string" ? v.trim() : v)),
});

/* Input schema – includes validation logic */
export const appointmentInputSchema = appointmentBaseSchema
  .extend({
    status: z
      .enum([
        AppointmentStatus.scheduled,
        AppointmentStatus.completed,
        AppointmentStatus.cancelled,
      ])
      .default(AppointmentStatus.scheduled),
  })
  .refine(
    (data) =>
      new Date(data.end).getTime() > new Date(data.start).getTime(),
    {
      message: "End time must be after start time",
      path: ["end"],
    }
  );

/* Stored entity schema */
export const appointmentSchema = appointmentBaseSchema.extend({
  id: z.string().min(1, "Id is required"),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  pendingSync: z.boolean().default(true),
  syncError: z.string().nullable().default(null),
});

function randomId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function createAppointmentId() {
  return `apt_${randomId()}`;
}

export function buildAppointment(input) {
  const now = new Date().toISOString();

  const parsedInput = appointmentInputSchema.parse(input);

  return appointmentSchema.parse({
    id: createAppointmentId(),
    ...parsedInput,
    createdAt: now,
    updatedAt: now,
    pendingSync: true,
    syncError: null,
  });
}
