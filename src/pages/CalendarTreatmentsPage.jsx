import { useEffect, useMemo, useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Bell } from "lucide-react";

import { useAppointments } from "../appointments/useAppointments";
import AppointmentDrawer from "../appointments/AppointmentDrawer";
import { getAllTherapists } from "../therapists/therapistsStore";
import { useAuthContext } from "../hooks/useAuthContext";
import "./CalendarTreatmentsPage.css";

const CLINIC_START_TIME = "07:00:00";
const CLINIC_END_TIME = "22:00:00";

function normalizeId(value) {
  return String(value ?? "").trim();
}

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function timeToMinutes(hhmmss) {
  const parts = String(hhmmss || "00:00:00").split(":");
  const hh = parseInt(parts[0] || "0", 10);
  const mm = parseInt(parts[1] || "0", 10);
  const h = Number.isFinite(hh) ? hh : 0;
  const m = Number.isFinite(mm) ? mm : 0;
  return h * 60 + m;
}

const CLINIC_START_MIN = timeToMinutes(CLINIC_START_TIME);
const CLINIC_END_MIN = timeToMinutes(CLINIC_END_TIME);

function dateToMinutes(date) {
  const d = new Date(date);
  return d.getHours() * 60 + d.getMinutes();
}

function isWithinClinicHours(date) {
  const mins = dateToMinutes(date);
  return mins >= CLINIC_START_MIN && mins < CLINIC_END_MIN;
}

function isRangeWithinClinicHours(start, end) {
  if (!start || !end) return false;
  const s = new Date(start);
  const e = new Date(end);
  if (!Number.isFinite(s.getTime()) || !Number.isFinite(e.getTime())) return false;
  if (e.getTime() <= s.getTime()) return false;

  const startOk = isWithinClinicHours(s);
  const endMinus1ms = new Date(e.getTime() - 1);
  const endOk = isWithinClinicHours(endMinus1ms);

  return startOk && endOk;
}

function getPatientFullName(patient) {
  if (!patient) return "";
  if (patient.fullName) return String(patient.fullName).trim();

  const first = String(patient.firstName || "").trim();
  const last = String(patient.lastName || "").trim();
  return `${first} ${last}`.trim();
}

function getPatientId(patient, fallbackId) {
  return String(patient?.idNumber || patient?.id || patient?.patientId || fallbackId || "")
    .replace(/\D/g, "")
    .trim();
}

function buildEventTitle(patient, appointment) {
  const name = getPatientFullName(patient);
  const id = getPatientId(patient, appointment?.patientId);

  if (name && id) return `${name} · ${id}`;
  if (name) return name;
  if (id) return `Patient · ${id}`;
  return "Appointment";
}

function hashToIndex(str, modulo) {
  let h = 0;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return modulo > 0 ? h % modulo : 0;
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

function sameDay(a, b) {
  const d1 = new Date(a);
  const d2 = new Date(b);
  if (!Number.isFinite(d1.getTime()) || !Number.isFinite(d2.getTime())) return false;
  return d1.getFullYear() === d2.getFullYear() && d1.getMonth() === d2.getMonth() && d1.getDate() === d2.getDate();
}

function formatDMY(dateLike) {
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
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

function getTherapistNameById(map, id) {
  const key = String(id || "").trim();
  if (!key) return "another therapist";
  return map.get(key) || key;
}

function checkPatientSameDayAndOverlap({
  allAppointments,
  candidate,
  ignoreId = null,
  therapistNameById,
}) {
  const patientId = digitsOnly(candidate?.patientId);
  const therapistId = String(candidate?.therapistId || "").trim();
  if (!patientId || !therapistId) return { ok: true, warned: false };

  const others = (allAppointments || []).filter((a) => {
    if (!a) return false;
    if (ignoreId && String(a.id) === String(ignoreId)) return false;
    const aPid = digitsOnly(a.patientId);
    if (!aPid || aPid !== patientId) return false;
    const aTid = String(a.therapistId || "").trim();
    return aTid && aTid !== therapistId;
  });

  if (!others.length) return { ok: true, warned: false };

  const overlapHit = others.find((a) => overlaps(a.start, a.end, candidate.start, candidate.end));
  if (overlapHit) {
    const otherName = getTherapistNameById(therapistNameById, overlapHit.therapistId);
    return {
      ok: false,
      warned: false,
      reason: `Cannot create/update: this patient already has an appointment at the same time with ${otherName}.`,
    };
  }

  const sameDayHit = others.find((a) => sameDay(a.start, candidate.start));
  if (sameDayHit) {
    const dmy = formatDMY(candidate.start);
    const otherName = getTherapistNameById(therapistNameById, sameDayHit.therapistId);
    const msg =
      `Warning: this patient already has an appointment on ${dmy} with ${otherName}.\n\nDo you want to continue?`;
    const ok = window.confirm(msg);
    if (!ok) return { ok: false, warned: true, reason: "Cancelled by user." };
    return { ok: true, warned: true };
  }

  return { ok: true, warned: false };
}

export default function CalendarTreatmentsPage({ medplumProfile, patients = [] }) {
  const { isAdmin, therapistId } = useAuthContext();
  const { appointments, loading, addAppointment, updateAppointment, deleteAppointment } = useAppointments();

  const [therapists, setTherapists] = useState([]);
  const reloadRef = useRef(null);

  const reloadTherapists = async () => {
    try {
      const list = await getAllTherapists();
      setTherapists(Array.isArray(list) ? list : []);
    } catch {
      setTherapists([]);
    }
  };

  reloadRef.current = reloadTherapists;

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        const list = await getAllTherapists();
        if (!alive) return;
        setTherapists(Array.isArray(list) ? list : []);
      } catch {
        if (!alive) return;
        setTherapists([]);
      }
    })();

    const onFocus = () => reloadRef.current?.();
    window.addEventListener("focus", onFocus);

    return () => {
      alive = false;
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const therapistNameById = useMemo(() => {
    const map = new Map();
    for (const t of Array.isArray(therapists) ? therapists : []) {
      const id = String(t?.id || "").trim();
      if (!id) continue;
      map.set(id, String(t?.name || t?.fullName || id).trim() || id);
    }
    return map;
  }, [therapists]);

  const therapistOptions = useMemo(() => {
    return (Array.isArray(therapists) ? therapists : [])
      .filter((t) => t && t.active !== false)
      .map((t) => ({
        value: String(t.id).trim(),
        label: String(t.name || t.id).trim(),
      }))
      .filter((t) => t.value)
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [therapists]);

  const currentTherapistId = useMemo(() => {
    if (isAdmin) return "";
    return normalizeId(therapistId);
  }, [isAdmin, therapistId]);

  const visibleAppointments = useMemo(() => {
    if (isAdmin) return appointments || [];
    const tid = String(currentTherapistId || "").trim();
    if (!tid) return [];
    return (appointments || []).filter((a) => String(a.therapistId || "").trim() === tid);
  }, [appointments, isAdmin, currentTherapistId]);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create");
  const [activeId, setActiveId] = useState(null);
  const [initialValues, setInitialValues] = useState(null);

  const patientsById = useMemo(() => {
    const map = new Map();
    for (const p of Array.isArray(patients) ? patients : []) {
      const key = String(p?.idNumber || p?.id || p?.patientId || "").replace(/\D/g, "").trim();
      if (key) map.set(key, p);
    }
    return map;
  }, [patients]);

  const events = useMemo(() => {
    return (visibleAppointments || []).map((a) => {
      const patientKey = String(a?.patientId || "").replace(/\D/g, "").trim();
      const patient = patientsById.get(patientKey) || null;

      const therapistKey = String(a?.therapistId || currentTherapistId || "").trim();
      const therapistColorIndex = hashToIndex(therapistKey, 6);

      return {
        id: a.id,
        title: buildEventTitle(patient, a),
        start: a.start,
        end: a.end,
        extendedProps: {
          appointment: a,
          patient,
          therapistColorIndex,
        },
      };
    });
  }, [visibleAppointments, patientsById, currentTherapistId]);

  const openCreateDrawer = (values) => {
    reloadRef.current?.();
    setDrawerMode("create");
    setActiveId(null);
    setInitialValues(values);
    setDrawerOpen(true);
  };

  const openEditDrawer = (appointment) => {
    if (!appointment) return;
    if (!isAdmin && String(appointment.therapistId || "").trim() !== String(currentTherapistId || "").trim()) return;

    reloadRef.current?.();
    setDrawerMode("edit");
    setActiveId(appointment.id);
    setInitialValues({
      patientId: appointment.patientId,
      therapistId: appointment.therapistId,
      start: appointment.start,
      end: appointment.end,
      status: appointment.status,
      notes: appointment.notes,
    });
    setDrawerOpen(true);
  };

  const getDefaultSlot = () => {
    const now = new Date();
    const start = new Date(now);
    start.setSeconds(0, 0);

    if (start.getHours() < 9) start.setHours(9, 0, 0, 0);
    else if (start.getHours() >= 18) {
      start.setDate(start.getDate() + 1);
      start.setHours(9, 0, 0, 0);
    } else {
      start.setHours(start.getHours() + 1, 0, 0, 0);
    }

    const end = new Date(start);
    end.setMinutes(end.getMinutes() + 30);
    return { start, end };
  };

  const handleAddClick = () => {
    const { start, end } = getDefaultSlot();

    if (!isRangeWithinClinicHours(start, end)) {
      alert("Appointments can only be created during clinic hours (07:00–22:00).");
      return;
    }

    openCreateDrawer({
      patientId: "",
      therapistId: isAdmin ? "" : String(currentTherapistId || "").trim(),
      start: start.toISOString(),
      end: end.toISOString(),
      status: "scheduled",
      notes: "",
    });
  };

  const handleSelect = (selectInfo) => {
    if (!isRangeWithinClinicHours(selectInfo.start, selectInfo.end)) return;

    openCreateDrawer({
      patientId: "",
      therapistId: isAdmin ? "" : String(currentTherapistId || "").trim(),
      start: selectInfo.start.toISOString(),
      end: selectInfo.end.toISOString(),
      status: "scheduled",
      notes: "",
    });
  };

  const handleEventClick = (clickInfo) => {
    const appointment = clickInfo.event.extendedProps?.appointment;
    if (appointment) openEditDrawer(appointment);
  };

  const handleEventDrop = async (info) => {
    const appt = info.event.extendedProps?.appointment;
    const nextStart = info.event.start;
    const nextEnd = info.event.end || info.event.start;

    if (!isRangeWithinClinicHours(nextStart, nextEnd)) {
      info.revert();
      return;
    }

    const therapistIdLocal = String(appt?.therapistId || (isAdmin ? "" : currentTherapistId) || "").trim();
    if (!therapistIdLocal) {
      info.revert();
      return;
    }

    const candidate = {
      therapistId: therapistIdLocal,
      patientId: digitsOnly(appt?.patientId),
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
    };

    if (hasTherapistConflict(appointments, candidate, info.event.id)) {
      alert("This time is not available for the selected therapist (double booking).");
      info.revert();
      return;
    }

    const patientCheck = checkPatientSameDayAndOverlap({
      allAppointments: appointments,
      candidate,
      ignoreId: info.event.id,
      therapistNameById,
    });

    if (!patientCheck.ok) {
      if (patientCheck.reason && patientCheck.reason !== "Cancelled by user.") alert(patientCheck.reason);
      info.revert();
      return;
    }

    try {
      await updateAppointment(info.event.id, { start: candidate.start, end: candidate.end, pendingSync: true });
    } catch (e) {
      info.revert();
      if (e?.message) alert(String(e.message));
    }
  };

  const handleEventResize = async (info) => {
    const appt = info.event.extendedProps?.appointment;
    const nextStart = info.event.start;
    const nextEnd = info.event.end || info.event.start;

    if (!isRangeWithinClinicHours(nextStart, nextEnd)) {
      info.revert();
      return;
    }

    const therapistIdLocal = String(appt?.therapistId || (isAdmin ? "" : currentTherapistId) || "").trim();
    if (!therapistIdLocal) {
      info.revert();
      return;
    }

    const candidate = {
      therapistId: therapistIdLocal,
      patientId: digitsOnly(appt?.patientId),
      start: nextStart.toISOString(),
      end: nextEnd.toISOString(),
    };

    if (hasTherapistConflict(appointments, candidate, info.event.id)) {
      alert("This time is not available for the selected therapist (double booking).");
      info.revert();
      return;
    }

    const patientCheck = checkPatientSameDayAndOverlap({
      allAppointments: appointments,
      candidate,
      ignoreId: info.event.id,
      therapistNameById,
    });

    if (!patientCheck.ok) {
      if (patientCheck.reason && patientCheck.reason !== "Cancelled by user.") alert(patientCheck.reason);
      info.revert();
      return;
    }

    try {
      await updateAppointment(info.event.id, { start: candidate.start, end: candidate.end, pendingSync: true });
    } catch (e) {
      info.revert();
      if (e?.message) alert(String(e.message));
    }
  };

  const handleSave = async (values) => {
    const s = new Date(values.start);
    const e = new Date(values.end);

    if (!isRangeWithinClinicHours(s, e)) {
      alert("Appointments can only be saved during clinic hours (07:00–22:00).");
      return;
    }

    const therapistIdLocal = isAdmin ? String(values.therapistId || "").trim() : String(currentTherapistId || "").trim();

    if (isAdmin && !therapistIdLocal) {
      alert("Therapist is required.");
      return;
    }

    const candidate = {
      therapistId: therapistIdLocal,
      patientId: digitsOnly(values.patientId),
      start: values.start,
      end: values.end,
    };

    const ignoreId = drawerMode === "edit" ? activeId : null;

    if (hasTherapistConflict(appointments, candidate, ignoreId)) {
      alert("This time is not available for the selected therapist (double booking).");
      return;
    }

    const patientCheck = checkPatientSameDayAndOverlap({
      allAppointments: appointments,
      candidate,
      ignoreId,
      therapistNameById,
    });

    if (!patientCheck.ok) {
      if (patientCheck.reason && patientCheck.reason !== "Cancelled by user.") alert(patientCheck.reason);
      return;
    }

    try {
      if (drawerMode === "edit" && activeId) {
        await updateAppointment(activeId, { ...values, therapistId: therapistIdLocal });
        setDrawerOpen(false);
        return;
      }

      await addAppointment({ ...values, therapistId: therapistIdLocal });
      setDrawerOpen(false);
    } catch (e2) {
      if (e2?.message) alert(String(e2.message));
    }
  };

  const handleDelete = async () => {
    if (!activeId) return;
    await deleteAppointment(activeId);
    setDrawerOpen(false);
  };

  const handleOpenNotifications = () => {
    alert("Notifications will be added next (reminders & permissions).");
  };

  return (
    <div className="mc-calendar-page">
      <div className="mc-calendar-header">
        <div className="mc-calendar-title-wrap">
          <h1 className="mc-calendar-title">Appointments</h1>
          <p className="mc-calendar-subtitle">
            {loading ? "Loading appointments..." : `${visibleAppointments.length} appointments`}
          </p>
        </div>

        <div className="mc-calendar-actions">
          <button
            type="button"
            className="mc-icon-button"
            onClick={handleOpenNotifications}
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={18} />
          </button>

          <button type="button" className="mc-calendar-add" onClick={handleAddClick}>
            + Add
          </button>
        </div>
      </div>

      <div className="mc-calendar-card">
        <div className="mc-calendar-shell">
          <FullCalendar
            plugins={[timeGridPlugin, dayGridPlugin, interactionPlugin]}
            locale="en-GB"
            initialView="timeGridWeek"
            initialDate={new Date()}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridWeek,timeGridDay,dayGridMonth",
            }}
            buttonText={{ today: "today", week: "week", day: "day", month: "month" }}
            titleFormat={{ year: "numeric", month: "2-digit", day: "2-digit" }}
            dayHeaderFormat={{ weekday: "short", day: "2-digit", month: "2-digit" }}
            slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
            nowIndicator
            allDaySlot={false}
            selectable
            selectMirror
            select={handleSelect}
            events={events}
            eventClick={handleEventClick}
            editable
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
            slotDuration="00:15:00"
            snapDuration="00:15:00"
            slotMinTime={CLINIC_START_TIME}
            slotMaxTime={CLINIC_END_TIME}
            businessHours={{
              daysOfWeek: [0, 1, 2, 3, 4, 5, 6],
              startTime: "07:00",
              endTime: "22:00",
            }}
            height="auto"
            expandRows
            scrollTime="07:00:00"
            navLinks
            navLinkDayClick={(date) => {
              const api = date.view.calendar;
              api.changeView("timeGridDay", date.date);
            }}
            navLinkWeekClick={(date) => {
              const api = date.view.calendar;
              api.changeView("timeGridWeek", date.date);
            }}
            dateClick={(info) => {
              if (info.view.type === "dayGridMonth") {
                info.view.calendar.changeView("timeGridDay", info.date);
              }
            }}
            dayCellDidMount={(arg) => {
              if (arg.view.type !== "dayGridMonth") return;
              arg.el.addEventListener("dblclick", () => {
                arg.view.calendar.changeView("timeGridDay", arg.date);
              });
            }}
            eventClassNames={(arg) => {
              const end = arg.event.end || arg.event.start;
              const isPast = end ? end.getTime() < Date.now() : false;

              const idx = arg.event.extendedProps?.therapistColorIndex;
              const therapistClass = Number.isInteger(idx) ? `mc-event--t${idx}` : "";

              return ["mc-event", therapistClass, isPast ? "mc-event--past" : "mc-event--active"].filter(Boolean);
            }}
          />
        </div>
      </div>

      <AppointmentDrawer
        open={drawerOpen}
        mode={drawerMode}
        patients={patients}
        initialValues={initialValues}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        loading={false}
        isAdmin={isAdmin}
        currentTherapistId={currentTherapistId}
        therapistOptions={therapistOptions}
      />
    </div>
  );
}
