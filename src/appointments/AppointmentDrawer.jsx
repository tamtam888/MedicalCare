import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { appointmentInputSchema, AppointmentStatus } from "./appointmentSchema";
import { toISODateTimeLocalInput, fromISODateTimeLocalInput } from "../utils/dateFormat";
import { capitalizeWords, isProbablyId, capitalizeSentences } from "../utils/textFormatters";
import "./AppointmentDrawer.css";

function normalize(value) {
  return String(value ?? "").trim();
}

function normalizeText(value) {
  return normalize(value).toLowerCase().replace(/\s+/g, " ");
}

function digitsOnly(value) {
  return normalize(value).replace(/\D/g, "");
}

function getPatientIdNumber(patient) {
  return digitsOnly(patient?.idNumber ?? patient?.patientId ?? patient?.id);
}

function getPatientName(patient) {
  if (!patient) return "";
  if (patient.fullName) return capitalizeWords(patient.fullName);

  const first = capitalizeWords(patient.firstName || "");
  const last = capitalizeWords(patient.lastName || "");
  return `${first} ${last}`.trim();
}

function getPatientLabel(patient) {
  const name = getPatientName(patient);
  const idn = getPatientIdNumber(patient);
  if (name && idn) return `${name} · ${idn}`;
  return name || idn || "Unknown patient";
}

function looksLikeId(input) {
  const raw = normalize(input);
  const d = digitsOnly(raw);
  if (!d) return false;
  const allDigits = d.length === raw.length;
  return allDigits || d.length >= 5;
}

function resolvePatient(list, input) {
  const raw = normalize(input);
  const d = digitsOnly(raw);

  if (!raw) return { kind: "empty", patient: null, idNumber: "", message: null };

  if (looksLikeId(raw)) {
    const match = list.find((p) => getPatientIdNumber(p) === d) || null;
    return {
      kind: "id",
      patient: match,
      idNumber: match ? getPatientIdNumber(match) : d,
      message: match ? null : "Patient not found. Enter a valid ID.",
    };
  }

  const q = normalizeText(raw);
  const matches = list.filter((p) => normalizeText(getPatientName(p)).includes(q));

  if (matches.length === 1) {
    const p = matches[0];
    return { kind: "name", patient: p, idNumber: getPatientIdNumber(p), message: null };
  }

  if (matches.length > 1) {
    return { kind: "ambiguous", patient: null, idNumber: "", message: "Multiple matches. Enter the patient's ID." };
  }

  return { kind: "not_found", patient: null, idNumber: "", message: "Patient not found. Enter a valid ID." };
}

function buildSuggestions(list, query) {
  const q = normalizeText(query);
  const qDigits = digitsOnly(query);
  const hasQuery = Boolean(normalize(query));

  const filtered = hasQuery
    ? list.filter((p) => {
        const name = normalizeText(getPatientName(p));
        const idn = getPatientIdNumber(p);
        if (qDigits && (looksLikeId(query) || qDigits.length >= 3)) return idn.includes(qDigits);
        return name.includes(q);
      })
    : list;

  const uniqueById = new Map();
  for (const p of filtered) {
    const idn = getPatientIdNumber(p);
    const label = getPatientLabel(p);
    const key = idn || label;
    if (!key) continue;
    if (!uniqueById.has(key)) uniqueById.set(key, p);
  }

  return Array.from(uniqueById.values()).slice(0, 30);
}

export default function AppointmentDrawer({
  open,
  mode,
  patients = [],
  initialValues,
  onClose,
  onSave,
  onDelete,
  loading,
  isAdmin = false,
  currentTherapistId = "",
  therapistOptions = [],
}) {
  const list = Array.isArray(patients) ? patients : [];
  const safeTherapists = Array.isArray(therapistOptions) ? therapistOptions : [];

  const form = useForm({
    resolver: zodResolver(appointmentInputSchema),
    defaultValues: {
      patientId: "",
      therapistId: "",
      start: "",
      end: "",
      status: AppointmentStatus.scheduled,
      notes: "",
    },
    mode: "onBlur",
  });

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    trigger,
    setError,
    clearErrors,
    formState: { errors, isSubmitting },
  } = form;

  const patientIdValue = watch("patientId");
  const startValue = watch("start");
  const endValue = watch("end");
  const notesValue = watch("notes");
  const therapistIdValue = watch("therapistId");

  const [query, setQuery] = useState("");

  const resolution = useMemo(() => resolvePatient(list, query), [list, query]);
  const suggestions = useMemo(() => buildSuggestions(list, query), [list, query]);

  const datalistId = "mc-patient-datalist";

  useEffect(() => {
    if (!open) return;

    const baseTherapistId = isAdmin
      ? String(initialValues?.therapistId || "").trim()
      : String(initialValues?.therapistId || currentTherapistId || "").trim();

    reset({
      patientId: initialValues?.patientId ? digitsOnly(initialValues.patientId) : "",
      therapistId: baseTherapistId,
      start: initialValues?.start || "",
      end: initialValues?.end || "",
      status: initialValues?.status || AppointmentStatus.scheduled,
      notes: initialValues?.notes || "",
    });
  }, [open, initialValues, reset, isAdmin, currentTherapistId]);

  useEffect(() => {
    if (!open) return;

    const pid = initialValues?.patientId ? digitsOnly(initialValues.patientId) : "";
    if (pid) {
      const p = list.find((x) => getPatientIdNumber(x) === pid) || null;
      setQuery(p ? getPatientLabel(p) : pid);
      return;
    }

    setQuery("");
  }, [open, initialValues, list]);

  useEffect(() => {
    if (!open) return;

    if (!normalize(query)) {
      setValue("patientId", "", { shouldValidate: true, shouldDirty: true });
      clearErrors("patientId");
      return;
    }

    if (resolution.patient && resolution.idNumber) {
      setValue("patientId", resolution.idNumber, { shouldValidate: true, shouldDirty: true });
      clearErrors("patientId");
      return;
    }

    setValue("patientId", "", { shouldValidate: true, shouldDirty: true });

    if (resolution.message) {
      setError("patientId", { type: "manual", message: resolution.message });
    } else {
      clearErrors("patientId");
    }
  }, [open, query, resolution, setValue, setError, clearErrors]);

  useEffect(() => {
    if (!open) return;
    if (isAdmin) return;

    const locked = String(currentTherapistId || "").trim();
    if (!locked) return;

    if (String(therapistIdValue || "").trim() !== locked) {
      setValue("therapistId", locked, { shouldValidate: true, shouldDirty: true });
    }
  }, [open, isAdmin, currentTherapistId, therapistIdValue, setValue]);

  const clearPatient = async () => {
    setQuery("");
    setValue("patientId", "", { shouldValidate: true, shouldDirty: true });
    clearErrors("patientId");
    await trigger("patientId");
  };

  const handleQueryChange = (value) => {
    const raw = String(value ?? "");
    if (isProbablyId(raw)) {
      setQuery(raw);
      return;
    }
    setQuery(capitalizeWords(raw));
  };

  const handleNotesBlur = () => {
    const next = capitalizeSentences(String(notesValue || ""));
    if (next !== notesValue) {
      setValue("notes", next, { shouldDirty: true, shouldValidate: true });
    }
  };

  const submit = async (values) => {
    const pid = digitsOnly(values.patientId);

    if (!pid || !resolution.patient) {
      setError("patientId", { type: "manual", message: resolution.message || "Patient is required." });
      return;
    }

    const therapistId = isAdmin
      ? String(values.therapistId || "").trim()
      : String(currentTherapistId || values.therapistId || "").trim();

    if (isAdmin && !therapistId) {
      setError("therapistId", { type: "manual", message: "Therapist is required." });
      return;
    }

    await onSave({
      ...values,
      patientId: pid,
      therapistId,
      notes: capitalizeSentences(String(values.notes || "")),
    });
  };

  if (!open) return null;

  const showLinked = Boolean(resolution.patient) && Boolean(resolution.idNumber);
  const therapistsEmpty = safeTherapists.length === 0;

  return (
    <div className="mc-drawer-overlay" onMouseDown={onClose}>
      <aside className="mc-drawer" role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()}>
        <header className="mc-drawer-header">
          <div className="mc-drawer-titlewrap">
            <h2 className="mc-drawer-title">{mode === "edit" ? "Edit appointment" : "Add appointment"}</h2>
            <p className="mc-drawer-subtitle">Schedule and manage treatments in your calendar.</p>
          </div>

          <button type="button" className="mc-drawer-close" onClick={onClose}>
            ✕
          </button>
        </header>

        <form className="mc-drawer-body" onSubmit={handleSubmit(submit)}>
          <div className="mc-field">
            <div className="mc-field-row">
              <label className="mc-label">Patient</label>
              {(query || patientIdValue) && (
                <button type="button" className="mc-field-clear" onClick={clearPatient}>
                  Clear
                </button>
              )}
            </div>

            <input type="hidden" {...register("patientId")} />

            <div className="mc-combobox">
              <input
                className="mc-input"
                placeholder="Type name or ID…"
                value={query}
                autoComplete="off"
                list={datalistId}
                onChange={(e) => handleQueryChange(e.target.value)}
              />

              <datalist id={datalistId}>
                {suggestions.map((p) => (
                  <option key={getPatientIdNumber(p) || getPatientLabel(p)} value={getPatientLabel(p)} />
                ))}
              </datalist>

              {showLinked ? (
                <div className="mc-combobox-empty">Linked: {getPatientLabel(resolution.patient)}</div>
              ) : resolution.message ? (
                <div className="mc-combobox-empty">{resolution.message}</div>
              ) : null}
            </div>

            {errors.patientId && <p className="mc-error">{String(errors.patientId.message)}</p>}
          </div>

          <div className="mc-grid2">
            <div className="mc-field">
              <label className="mc-label">Start</label>
              <input
                className="mc-input"
                type="datetime-local"
                lang="en-GB"
                value={toISODateTimeLocalInput(startValue)}
                onChange={(e) => setValue("start", fromISODateTimeLocalInput(e.target.value), { shouldValidate: true })}
              />
              {errors.start && <p className="mc-error">{String(errors.start.message)}</p>}
            </div>

            <div className="mc-field">
              <label className="mc-label">End</label>
              <input
                className="mc-input"
                type="datetime-local"
                lang="en-GB"
                value={toISODateTimeLocalInput(endValue)}
                onChange={(e) => setValue("end", fromISODateTimeLocalInput(e.target.value), { shouldValidate: true })}
              />
              {errors.end && <p className="mc-error">{String(errors.end.message)}</p>}
            </div>
          </div>

          <div className="mc-grid2">
            <div className="mc-field">
              <label className="mc-label">Therapist</label>

              {isAdmin ? (
                <select className="mc-input" {...register("therapistId", { required: true })} disabled={therapistsEmpty}>
                  <option value="">{therapistsEmpty ? "No therapists available" : "Select therapist…"}</option>
                  {safeTherapists.map((t) => (
                    <option key={String(t.value)} value={String(t.value)}>
                      {String(t.label)}
                    </option>
                  ))}
                </select>
              ) : (
                <input className="mc-input" {...register("therapistId")} disabled />
              )}

              {errors.therapistId && <p className="mc-error">{String(errors.therapistId.message)}</p>}
            </div>

            <div className="mc-field">
              <label className="mc-label">Status</label>
              <select className="mc-input" {...register("status")}>
                <option value={AppointmentStatus.scheduled}>Scheduled</option>
                <option value={AppointmentStatus.completed}>Completed</option>
                <option value={AppointmentStatus.cancelled}>Cancelled</option>
              </select>
            </div>
          </div>

          <div className="mc-field">
            <label className="mc-label">Notes</label>
            <textarea className="mc-textarea" rows={4} {...register("notes")} onBlur={handleNotesBlur} />
          </div>

          <footer className="mc-drawer-footer">
            {mode === "edit" ? (
              <button
                type="button"
                className="mc-button mc-button--danger"
                onClick={onDelete}
                disabled={loading || isSubmitting}
              >
                Delete
              </button>
            ) : (
              <span />
            )}

            <div className="mc-drawer-footer-actions">
              <button type="button" className="mc-button" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="mc-button mc-button--primary" disabled={loading || isSubmitting}>
                {mode === "edit" ? "Save changes" : "Create appointment"}
              </button>
            </div>
          </footer>
        </form>
      </aside>
    </div>
  );
}
