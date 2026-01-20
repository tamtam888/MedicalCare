import { useMemo } from "react";
import { useAppointments } from "../appointments/useAppointments";
import { formatDateTimeDMY } from "../utils/dateFormat";
import "./PatientAppointments.css";

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "");
}

function toDate(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getAppointmentKey(a) {
  return a?.id || a?.appointmentId || a?._id || `${a.patientId}-${a.start}`;
}

export default function PatientAppointments({
  patient,
  isAdmin = false,
  currentTherapistId = null,
  onOpenAppointment,
  previousLimit = 3,
}) {
  const { appointments, loading } = useAppointments();
  const patientId = digitsOnly(patient?.idNumber);

  const { nextAppointment, previousAppointments } = useMemo(() => {
    const now = new Date();

    const mine = (appointments || [])
      .filter((a) => digitsOnly(a.patientId) === patientId)
      .filter((a) => {
        if (isAdmin) return true;
        if (!currentTherapistId) return true;
        return String(a.therapistId || "") === String(currentTherapistId || "");
      })
      .map((a) => ({ ...a, _start: toDate(a.start) }))
      .filter((a) => a._start)
      .sort((a, b) => a._start - b._start);

    const upcoming = mine.filter((a) => a._start >= now);
    const past = mine.filter((a) => a._start < now).sort((a, b) => b._start - a._start);

    return {
      nextAppointment: upcoming[0] || null,
      previousAppointments: past.slice(0, previousLimit),
    };
  }, [appointments, patientId, isAdmin, currentTherapistId, previousLimit]);

  return (
    <section className="pa">
      {loading ? <div className="pa-loading">Loading…</div> : null}

      <div className="pa-section">
        <div className="pa-section-title">Next</div>

        {!nextAppointment ? (
          <div className="pa-empty">No upcoming appointment.</div>
        ) : (
          <button
            type="button"
            className="pa-link"
            onClick={() => onOpenAppointment?.(nextAppointment)}
          >
            {formatDateTimeDMY(nextAppointment.start)}
          </button>
        )}
      </div>

      <div className="pa-section">
        <div className="pa-section-title">Previous</div>

        {previousAppointments.length === 0 ? (
          <div className="pa-empty">No previous appointments.</div>
        ) : (
          <ul className="pa-list">
            {previousAppointments.map((a) => (
              <li key={getAppointmentKey(a)} className="pa-item">
                <button
                  type="button"
                  className="pa-link"
                  onClick={() => onOpenAppointment?.(a)}
                >
                  {formatDateTimeDMY(a.start)}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
