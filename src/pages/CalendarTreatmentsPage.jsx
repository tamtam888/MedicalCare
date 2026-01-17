import { useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import timeGridPlugin from "@fullcalendar/timegrid";
import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import { Bell } from "lucide-react";

import { useAppointments } from "../appointments/useAppointments";
import AppointmentDrawer from "../appointments/AppointmentDrawer";
import "./CalendarTreatmentsPage.css";

const CLINIC_START_TIME = "07:00:00";
const CLINIC_END_TIME = "22:00:00";

function normalizeId(value) {
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
  return normalizeId(patient?.idNumber || patient?.id || patient?.patientId || fallbackId);
}

function buildEventTitle(patient, appointment) {
  const name = getPatientFullName(patient);
  const id = getPatientId(patient, appointment.patientId);

  if (name && id) return `${name} · ${id}`;
  if (name) return name;
  if (id) return `Patient · ${id}`;
  return "Appointment";
}

function hashToIndex(str, modulo) {
  let h = 0;
  for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % modulo;
}

export default function CalendarTreatmentsPage({ medplumProfile, patients = [] }) {
  const currentTherapistId = medplumProfile?.id || "local-therapist";
  const { appointments, loading, addAppointment, updateAppointment, deleteAppointment } = useAppointments();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState("create");
  const [activeId, setActiveId] = useState(null);
  const [initialValues, setInitialValues] = useState(null);

  const patientsById = useMemo(() => {
    const map = new Map();
    for (const p of Array.isArray(patients) ? patients : []) {
      const key = normalizeId(p.idNumber || p.id || p.patientId);
      if (key) map.set(key, p);
    }
    return map;
  }, [patients]);

  const events = useMemo(() => {
    return appointments.map((a) => {
      const patientKey = normalizeId(a.patientId);
      const patient = patientsById.get(patientKey) || null;

      const therapistKey = String(a.therapistId || currentTherapistId).trim();
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
  }, [appointments, patientsById, currentTherapistId]);

  const openCreateDrawer = (values) => {
    setDrawerMode("create");
    setActiveId(null);
    setInitialValues(values);
    setDrawerOpen(true);
  };

  const openEditDrawer = (appointment) => {
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

  const closeDrawer = () => setDrawerOpen(false);

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
      therapistId: currentTherapistId,
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
      therapistId: currentTherapistId,
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
    const nextStart = info.event.start;
    const nextEnd = info.event.end || info.event.start;

    if (!isRangeWithinClinicHours(nextStart, nextEnd)) {
      info.revert();
      return;
    }

    try {
      await updateAppointment(info.event.id, {
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
        pendingSync: true,
      });
    } catch {
      info.revert();
    }
  };

  const handleEventResize = async (info) => {
    const nextStart = info.event.start;
    const nextEnd = info.event.end || info.event.start;

    if (!isRangeWithinClinicHours(nextStart, nextEnd)) {
      info.revert();
      return;
    }

    try {
      await updateAppointment(info.event.id, {
        start: nextStart.toISOString(),
        end: nextEnd.toISOString(),
        pendingSync: true,
      });
    } catch {
      info.revert();
    }
  };

  const handleSave = async (values) => {
    const s = new Date(values.start);
    const e = new Date(values.end);

    if (!isRangeWithinClinicHours(s, e)) {
      alert("Appointments can only be saved during clinic hours (07:00–22:00).");
      return;
    }

    if (drawerMode === "edit" && activeId) {
      await updateAppointment(activeId, values);
      closeDrawer();
      return;
    }

    await addAppointment(values);
    closeDrawer();
  };

  const handleDelete = async () => {
    if (!activeId) return;
    await deleteAppointment(activeId);
    closeDrawer();
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
            {loading ? "Loading appointments..." : `${appointments.length} appointments`}
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
            initialView="timeGridWeek"
            initialDate={new Date()}
            headerToolbar={{
              left: "prev,next today",
              center: "title",
              right: "timeGridWeek,timeGridDay,dayGridMonth",
            }}
            buttonText={{ today: "today", week: "week", day: "day", month: "month" }}
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
        onClose={closeDrawer}
        onSave={handleSave}
        onDelete={handleDelete}
        loading={false}
      />
    </div>
  );
}
