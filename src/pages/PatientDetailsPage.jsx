import React, { useEffect, useMemo, useState, useId } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./PatientDetailsPage.css";

import RecordAudio from "../components/RecordAudio";
import PatientHistory from "../components/PatientHistory";
import AttachReports from "../components/AttachReports";
import CarePlanSection from "../components/CarePlanSection";
import { formatDateDMY, parseFlexibleDate } from "../utils/dateFormat";
import { Upload, Download, RefreshCw, X } from "lucide-react";

import PatientAppointments from "../components/PatientAppointments";
import AppointmentDrawer from "../appointments/AppointmentDrawer";
import { useAppointments } from "../appointments/useAppointments";

function buildFullName(p) {
  const first = (p?.firstName || "").trim();
  const last = (p?.lastName || "").trim();
  const full = `${first} ${last}`.trim();
  return full || "Unknown patient";
}

function buildInitials(p) {
  const a = (p?.firstName || "?").trim().slice(0, 1);
  const b = (p?.lastName || "").trim().slice(0, 1);
  return `${a}${b}`.toUpperCase();
}

function getGenderClass(p) {
  const g = String(p?.gender || "").trim().toLowerCase();
  if (g === "female" || g === "f") return "avatar-female";
  if (g === "male" || g === "m") return "avatar-male";
  return "avatar-other";
}

function getHeaderStatusClass(p) {
  const s = String(p?.clinicalStatus || "").trim().toLowerCase();
  if (s === "active") return "header-active";
  if (s === "stable") return "header-stable";
  if (s === "disabled") return "header-disabled";
  if (s === "not active" || s === "not-active" || s === "notactive") return "header-not-active";
  return "header-inactive";
}

function getStatusPillClass(p) {
  const s = String(p?.clinicalStatus || "").trim().toLowerCase();
  if (s === "active") return "status-pill status-active";
  if (s === "stable") return "status-pill status-stable";
  if (s === "disabled") return "status-pill status-disabled";
  if (s === "not active" || s === "not-active" || s === "notactive") return "status-pill status-not-active";
  return "status-pill status-inactive";
}

function InlineEditable({ value, placeholder = "-", inputType = "text", className = "", onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");

  useEffect(() => {
    if (!editing) setDraft(value ?? "");
  }, [value, editing]);

  const commit = () => {
    setEditing(false);
    const next = draft ?? "";
    if (next !== (value ?? "")) onChange?.(next);
  };

  if (!editing) {
    return (
      <span className={`editable-field ${className}`} onClick={() => setEditing(true)}>
        {String(value ?? "").trim().length ? value : placeholder}
      </span>
    );
  }

  return (
    <input
      className={`inline-input ${className}`}
      type={inputType}
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
    />
  );
}

function pickDobValue(p) {
  return p?.dob ?? p?.dateOfBirth ?? p?.birthDate ?? p?.birthDateTime ?? p?.dobText ?? "";
}

function formatDobForHeader(p) {
  const raw = pickDobValue(p);
  const d = parseFlexibleDate(raw);
  if (!d) return "-";
  return formatDateDMY(d);
}

function pickMedplumPatientId(p) {
  const candidates = [
    p?.medplumPatientId,
    p?.medplumId,
    p?.medplumPatient,
    p?.fhirId,
    p?.fhirPatientId,
    p?.resourceId,
    p?.id,
  ];

  for (const c of candidates) {
    const v = String(c || "").trim();
    if (v) return v;
  }
  return "";
}

function getAppointmentId(a) {
  return a?.id || a?.appointmentId || a?._id || null;
}

function CollapsibleBlock({ title, subtitle = "", defaultOpen = false, children }) {
  const rid = useId();
  const panelId = `pd_panel_${String(rid).replace(/:/g, "")}`;
  const btnId = `pd_btn_${String(rid).replace(/:/g, "")}`;
  const [open, setOpen] = useState(Boolean(defaultOpen));

  return (
    <div className="pd-card">
      <button
        id={btnId}
        type="button"
        className="pd-header-btn"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open ? "true" : "false"}
        aria-controls={panelId}
      >
        <span className="pd-header-left">
          <span className="pd-title">{title}</span>
          {subtitle ? <span className="pd-subtitle">{subtitle}</span> : null}
        </span>
        <span className={`pd-chevron ${open ? "open" : ""}`} aria-hidden="true">
          ▾
        </span>
      </button>

      <div id={panelId} role="region" aria-labelledby={btnId} className={`pd-panel ${open ? "open" : ""}`}>
        {children}
      </div>
    </div>
  );
}

export default function PatientDetailsPage({
  patients = [],
  onUpdatePatient,
  handleSelectPatient,
  handleSaveTranscription,
  handleDeleteReport,
  handleExportPatients,
  handleImportPatients,
  handleSaveReportEntry,
  handleSyncPatientToMedplum,
  handleSaveCarePlanEntry,
}) {
  const navigate = useNavigate();
  const params = useParams();
  const idNumberParam = params?.idNumber ?? params?.id ?? "";

  const patientFromStore = useMemo(() => {
    const key = String(idNumberParam || "").trim();
    if (!key) return null;
    return patients.find((p) => String(p?.idNumber || "").trim() === key) || null;
  }, [patients, idNumberParam]);

  const [editablePatient, setEditablePatient] = useState(patientFromStore);
  const [selectedHistoryIds, setSelectedHistoryIds] = useState(() => new Set());

  useEffect(() => {
    setEditablePatient(patientFromStore);
  }, [patientFromStore]);

  useEffect(() => {
    setSelectedHistoryIds(new Set());
  }, [editablePatient?.idNumber]);

  const toggleHistorySelected = (entryId) => {
    const id = String(entryId || "");
    if (!id) return;

    setSelectedHistoryIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelectedHistory = () => setSelectedHistoryIds(new Set());

  const selectedHistoryEntries = useMemo(() => {
    const all = Array.isArray(editablePatient?.history) ? editablePatient.history : [];
    if (!selectedHistoryIds.size) return [];
    return all.filter((e) => selectedHistoryIds.has(String(e?.id || "")));
  }, [editablePatient?.history, selectedHistoryIds]);

  const updatePatient = (updated) => {
    setEditablePatient(updated);
    onUpdatePatient?.(updated);
  };

  const updateField = (field, value) => {
    updatePatient({ ...editablePatient, [field]: value });
  };

  const updateHistory = (nextHistory) => {
    const safe = Array.isArray(nextHistory) ? nextHistory : [];
    updatePatient({ ...editablePatient, history: safe });
  };

  const handleClose = () => navigate("/patients");

  const handleExportClick = () => {
    if (typeof handleExportPatients === "function") handleExportPatients();
  };

  const handleImportChange = (e) => {
    const file = e?.target?.files?.[0] || null;
    if (typeof handleImportPatients === "function") handleImportPatients(file);
    if (e?.target) e.target.value = "";
  };

  const onSaveTranscriptionLocal = (payloadOrPatientId, maybeText, maybeAudioId) => {
    const patientId = editablePatient?.idNumber;
    if (!patientId) return;

    let text = "";
    let audioId = null;

    if (typeof payloadOrPatientId === "object" && payloadOrPatientId) {
      text = String(payloadOrPatientId.text || "").trim();
      audioId = payloadOrPatientId.audioId || null;
    } else {
      text = String(maybeText || "").trim();
      audioId = maybeAudioId || null;
    }

    if (!text && !audioId) return;

    handleSelectPatient?.(patientId);
    if (typeof handleSaveTranscription === "function") {
      handleSaveTranscription(patientId, text, audioId || null);
    }
  };

  const handleClickSyncPatient = () => {
    const patientId = editablePatient?.idNumber;
    if (!patientId) return;
    if (typeof handleSyncPatientToMedplum === "function") handleSyncPatientToMedplum(patientId);
  };

  const { addAppointment, updateAppointment, deleteAppointment } = useAppointments();

  const [apptDrawerOpen, setApptDrawerOpen] = useState(false);
  const [apptDrawerMode, setApptDrawerMode] = useState("add");
  const [apptInitialValues, setApptInitialValues] = useState(null);
  const [apptEditingId, setApptEditingId] = useState(null);
  const [apptSaving, setApptSaving] = useState(false);

  const openAddAppointmentForPatient = () => {
    const pid = String(editablePatient?.idNumber || "").replace(/\D/g, "");
    if (!pid) return;

    setApptEditingId(null);
    setApptDrawerMode("add");
    setApptInitialValues({
      patientId: pid,
      therapistId: "",
      start: "",
      end: "",
      status: "scheduled",
      notes: "",
    });
    setApptDrawerOpen(true);
  };

  const openEditAppointment = (appt) => {
    if (!appt) return;

    const id = getAppointmentId(appt);

    setApptEditingId(id);
    setApptDrawerMode("edit");
    setApptInitialValues({
      patientId: appt.patientId,
      therapistId: appt.therapistId || "",
      start: appt.start || "",
      end: appt.end || "",
      status: appt.status || "scheduled",
      notes: appt.notes || "",
    });
    setApptDrawerOpen(true);
  };

  const closeApptDrawer = () => {
    setApptDrawerOpen(false);
    setApptEditingId(null);
    setApptDrawerMode("add");
    setApptInitialValues(null);
  };

  const handleSaveAppointment = async (values) => {
    try {
      setApptSaving(true);

      if (apptDrawerMode === "edit") {
        if (!apptEditingId) return;
        await updateAppointment(apptEditingId, values);
      } else {
        await addAppointment(values);
      }

      closeApptDrawer();
    } finally {
      setApptSaving(false);
    }
  };

  const handleDeleteAppointment = async () => {
    if (!apptEditingId) return;

    const ok = window.confirm("Delete this appointment?");
    if (!ok) return;

    try {
      setApptSaving(true);
      await deleteAppointment(apptEditingId);
      closeApptDrawer();
    } finally {
      setApptSaving(false);
    }
  };

  if (!editablePatient) {
    return (
      <div className="patient-details-page">
        <div className="patient-card">
          <h2 className="section-title">Patient profile</h2>
          <div className="empty-state">Patient not found.</div>
          <button type="button" className="patients-toolbar-button" onClick={() => navigate("/patients")}>
            Back to patients list
          </button>
        </div>
      </div>
    );
  }

  const headerClass = `patient-header-wrapper ${getHeaderStatusClass(editablePatient)}`;
  const statusPill = getStatusPillClass(editablePatient);
  const dobFormatted = formatDobForHeader(editablePatient);

  const detailsSubtitleParts = [];
  if (String(editablePatient.phone || "").trim()) detailsSubtitleParts.push("phone");
  if (String(editablePatient.email || "").trim()) detailsSubtitleParts.push("email");
  if (String(editablePatient.address || "").trim()) detailsSubtitleParts.push("address");
  const detailsSubtitle = detailsSubtitleParts.length ? detailsSubtitleParts.join(" • ") : "Edit contact details";

  const historyCount = Array.isArray(editablePatient.history) ? editablePatient.history.length : 0;
  const selectedCount = selectedHistoryEntries.length;
  const historySubtitle = `${selectedCount} selected • ${historyCount} entries`;

  const reportsUploadedCount = Array.isArray(editablePatient.reports) ? editablePatient.reports.length : 0;
  const reportsSubtitle = `${selectedCount} selected • ${reportsUploadedCount} uploaded`;

  const medplumPatientId = pickMedplumPatientId(editablePatient);

  return (
    <div className="patient-details-page">
      <div className={headerClass}>
        <div className="patient-header-left">
          <div className={`patient-avatar-details ${getGenderClass(editablePatient)}`}>{buildInitials(editablePatient)}</div>

          <div className="patient-header-title-block">
            <h1 className="patient-details-name">{buildFullName(editablePatient)}</h1>

            <div className="patient-details-meta">
              <span className="meta-chip">
                <strong>ID:</strong> {editablePatient.idNumber || "-"}
              </span>

              <span className="meta-chip">
                <strong>DOB:</strong>{" "}
                <bdi dir="ltr" style={{ unicodeBidi: "isolate" }}>
                  {dobFormatted}
                </bdi>
              </span>

              <span className="meta-chip">
                <strong>Gender:</strong> {editablePatient.gender || "Not set"}
              </span>

              <span className={statusPill}>{editablePatient.clinicalStatus || "Not Active"}</span>
            </div>
          </div>
        </div>

        <div className="patients-page-header-actions">
          <button type="button" className="patients-toolbar-button" onClick={handleClose}>
            <span className="patients-toolbar-button-icon">
              <X size={16} />
            </span>
            <span>Close</span>
          </button>

          <button type="button" className="patients-toolbar-button" onClick={handleClickSyncPatient}>
            <span className="patients-toolbar-button-icon">
              <RefreshCw size={16} />
            </span>
            <span>Sync Patient</span>
          </button>

          <button type="button" className="patients-toolbar-button" onClick={handleExportClick}>
            <span className="patients-toolbar-button-icon">
              <Download size={16} />
            </span>
            <span>Export JSON</span>
          </button>

          <label className="patients-toolbar-button" style={{ cursor: "pointer" }}>
            <span className="patients-toolbar-button-icon">
              <Upload size={16} />
            </span>
            <span>Import</span>
            <input type="file" accept="application/json" style={{ display: "none" }} onChange={handleImportChange} />
          </label>
        </div>
      </div>

      <div className="patient-sections-stack">
        <CollapsibleBlock title="Patient details" subtitle={detailsSubtitle} defaultOpen={false}>
          <div className="patient-details-top-row">
            <div className="details-row-inline">
              <span className="details-label">Phone</span>
              <InlineEditable
                value={editablePatient.phone || ""}
                placeholder="Add phone number"
                inputType="tel"
                onChange={(val) => updateField("phone", val)}
                className="details-value"
              />
            </div>

            <div className="details-row-inline">
              <span className="details-label">Email</span>
              <InlineEditable
                value={editablePatient.email || ""}
                placeholder="Add email"
                onChange={(val) => updateField("email", val)}
                className="details-value"
              />
            </div>

            <div className="details-row-inline">
              <span className="details-label">Address</span>
              <InlineEditable
                value={editablePatient.address || ""}
                placeholder="Street, city, country"
                onChange={(val) => updateField("address", val)}
                className="details-value"
              />
            </div>
          </div>

          <div className="status-row">
            <span className="details-label">Clinical status</span>
            <select
              className="inline-input status-select"
              value={editablePatient.clinicalStatus || ""}
              onChange={(e) => updateField("clinicalStatus", e.target.value)}
            >
              <option value="">Not Active</option>
              <option value="Active">Active</option>
              <option value="Stable">Stable</option>
              <option value="Inactive">Inactive</option>
              <option value="Disabled">Disabled</option>
              <option value="Not Active">Not Active</option>
            </select>
          </div>
        </CollapsibleBlock>

        <CollapsibleBlock title="Appointments" subtitle="Scheduling" defaultOpen={false}>
          <div className="patients-page-header-actions" style={{ marginBottom: 12 }}>
            <button type="button" className="patients-toolbar-button" onClick={openAddAppointmentForPatient}>
              <span>Add appointment</span>
            </button>
          </div>

          <PatientAppointments patient={editablePatient} onOpenAppointment={openEditAppointment} />
        </CollapsibleBlock>

        <CollapsibleBlock title="Treatment transcription" subtitle="Record and improve visit notes" defaultOpen={true}>
          <RecordAudio selectedPatient={editablePatient} onSaveTranscription={onSaveTranscriptionLocal} />
        </CollapsibleBlock>

        <CollapsibleBlock title="Care plan" subtitle="Goals and exercises" defaultOpen={false}>
          <CarePlanSection patient={editablePatient} onUpdatePatient={updatePatient} onSaveCarePlanEntry={handleSaveCarePlanEntry} />
        </CollapsibleBlock>

        <CollapsibleBlock title="History" subtitle={historySubtitle} defaultOpen={false}>
          <PatientHistory
            patient={editablePatient}
            history={editablePatient.history || []}
            onChangeHistory={updateHistory}
            selectedIds={selectedHistoryIds}
            onToggleSelected={toggleHistorySelected}
          />
        </CollapsibleBlock>

        <CollapsibleBlock title="Reports" subtitle={reportsSubtitle} defaultOpen={false}>
          <AttachReports
            patient={editablePatient}
            patientId={editablePatient.idNumber}
            existingReports={editablePatient.reports || []}
            onDeleteReport={handleDeleteReport}
            selectedEntries={selectedHistoryEntries}
            onClearSelected={clearSelectedHistory}
            totalHistoryCount={historyCount}
            medplumPatientId={medplumPatientId}
            onSaveReportEntry={(entry) => {
              const patientId = editablePatient?.idNumber;
              if (!patientId) return;

              handleSelectPatient?.(patientId);

              if (typeof handleSaveReportEntry === "function") {
                handleSaveReportEntry(patientId, entry);
                return;
              }

              const current = Array.isArray(editablePatient.history) ? editablePatient.history : [];
              const existingIndex = current.findIndex((x) => String(x?.id || "") === String(entry?.id || ""));
              const next =
                existingIndex >= 0 ? current.map((x, idx) => (idx === existingIndex ? entry : x)) : [entry, ...current];
              updateHistory(next);
            }}
          />
        </CollapsibleBlock>
      </div>

      <AppointmentDrawer
        open={apptDrawerOpen}
        mode={apptDrawerMode}
        patients={patients}
        initialValues={apptInitialValues}
        onClose={closeApptDrawer}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        loading={apptSaving}
      />
    </div>
  );
}
