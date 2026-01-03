import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import "./PatientDetailsPage.css";

import RecordAudio from "../components/RecordAudio";
import PatientHistory from "../components/PatientHistory";
import AttachReports from "../components/AttachReports";
import { formatDateDMY, parseFlexibleDate } from "../utils/dateFormat";

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
  return (
    p?.dob ??
    p?.dateOfBirth ??
    p?.birthDate ??
    p?.birthDateTime ??
    p?.dobText ??
    ""
  );
}

function formatDobForHeader(p) {
  const raw = pickDobValue(p);
  const d = parseFlexibleDate(raw);
  if (!d) return "-";
  return formatDateDMY(d);
}

export default function PatientDetailsPage({
  patients = [],
  onUpdatePatient,
  handleSelectPatient,
  handleSaveTranscription,
  handleAddReport,
  handleDeleteReport,
  handleExportPatients,
  handleImportPatients,
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

  useEffect(() => {
    setEditablePatient(patientFromStore);
  }, [patientFromStore]);

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
    if (typeof handleImportPatients === "function") handleImportPatients(e);
    if (e?.target) e.target.value = "";
  };

  const onSaveTranscriptionLocal = (payloadOrPatientId, maybeText, maybeAudioId) => {
    const patientId = editablePatient?.idNumber;
    if (!patientId) return;

    let text = "";
    let audioId = null;
    let createdAt = Date.now();

    if (typeof payloadOrPatientId === "object" && payloadOrPatientId) {
      text = String(payloadOrPatientId.text || "").trim();
      audioId = payloadOrPatientId.audioId || null;
      createdAt = payloadOrPatientId.createdAt || Date.now();
    } else {
      text = String(maybeText || "").trim();
      audioId = maybeAudioId || null;
      createdAt = Date.now();
    }

    if (!text && !audioId) return;

    const entry = {
      id: crypto?.randomUUID?.() ?? `h_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: "transcription",
      date: new Date(createdAt).toISOString(),
      title: "Treatment transcription",
      summary: text,
      audioId: audioId || null,
      audioUrl: "",
      audioData: null,
    };

    const nextHistory = [entry, ...(Array.isArray(editablePatient.history) ? editablePatient.history : [])];

    updateHistory(nextHistory);

    handleSelectPatient?.(patientId);
    if (typeof handleSaveTranscription === "function") {
      handleSaveTranscription(patientId, text, audioId || null);
    }
  };

  const onAddReportLocal = (meta) => {
    const patientId = editablePatient?.idNumber;
    if (!patientId) return;
    handleSelectPatient?.(patientId);
    handleAddReport?.(patientId, meta);
  };

  if (!editablePatient) {
    return (
      <div className="patient-details-page">
        <div className="patient-card">
          <h2 className="section-title">Patient profile</h2>
          <div className="empty-state">Patient not found.</div>
          <button type="button" className="header-chip-btn" onClick={() => navigate("/patients")}>
            Back to patients list
          </button>
        </div>
      </div>
    );
  }

  const headerClass = `patient-header-wrapper ${getHeaderStatusClass(editablePatient)}`;
  const statusPill = getStatusPillClass(editablePatient);
  const dobFormatted = formatDobForHeader(editablePatient);

  return (
    <div className="patient-details-page">
      <div className={headerClass}>
        <div className="patient-header-left">
          <div className={`patient-avatar-details ${getGenderClass(editablePatient)}`}>
            {buildInitials(editablePatient)}
          </div>

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

        <div className="patient-header-actions">
          <button type="button" className="header-chip-btn header-chip-close" onClick={handleClose}>
            Close
          </button>

          <button type="button" className="header-chip-btn" onClick={handleExportClick}>
            Export patient (FHIR JSON)
          </button>

          <label className="header-chip-btn header-chip-import">
            <span>Import patient</span>
            <input
              type="file"
              accept="application/json"
              className="header-import-input"
              onChange={handleImportChange}
            />
          </label>
        </div>
      </div>

      <section className="patient-card">
        <h2 className="section-title">Patient details</h2>

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
      </section>

      <section className="patient-card">
        <h2 className="section-title">Treatment transcription</h2>
        <RecordAudio selectedPatient={editablePatient} onSaveTranscription={onSaveTranscriptionLocal} />
      </section>

      <section className="patient-card">
        <h2 className="section-title">History and reports</h2>
        <PatientHistory patient={editablePatient} history={editablePatient.history || []} onChangeHistory={updateHistory} />
        <AttachReports
          patientId={editablePatient.idNumber}
          existingReports={editablePatient.reports || []}
          onAddReport={onAddReportLocal}
          onDeleteReport={handleDeleteReport}
        />
      </section>
    </div>
  );
}
