import { useMemo, useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PatientHistory from "../components/PatientHistory";
import AttachReports from "../components/AttachReports";
import RecordAudio from "../components/RecordAudio";
import "./PatientDetailsPage.css";

function InlineEditable({
  value,
  placeholder = "-",
  onChange,
  inputType = "text",
  multiline = false,
  className = "",
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    if (!editing) {
      setDraft(value || "");
    }
  }, [value, editing]);

  const finish = () => {
    setEditing(false);
    const next = draft ?? "";
    if (next !== (value ?? "")) {
      onChange(next);
    }
  };

  if (!editing) {
    return (
      <span
        className={`editable-field ${className}`}
        onClick={() => setEditing(true)}
      >
        {value && String(value).trim().length > 0 ? value : placeholder}
      </span>
    );
  }

  if (multiline) {
    return (
      <textarea
        className={`text-area ${className}`}
        value={draft}
        autoFocus
        onBlur={finish}
        onChange={(e) => setDraft(e.target.value)}
      />
    );
  }

  return (
    <input
      type={inputType}
      className={`inline-input ${className}`}
      value={draft}
      autoFocus
      onBlur={finish}
      onChange={(e) => setDraft(e.target.value)}
    />
  );
}

function PatientDetailsPage({
  patients,
  selectedPatient,
  selectedPatientFullName,
  handleSelectPatient,
  handleAddReport,
  handleDeleteReport,
  handleSaveTranscription,
  handleEditPatient,
  onUpdatePatient,
  handleExportPatients,
  handleImportPatients,
}) {
  const { idNumber } = useParams();
  const navigate = useNavigate();

  const patient = useMemo(
    () =>
      patients.find(
        (p) =>
          p.idNumber &&
          p.idNumber.toString().trim() === String(idNumber).trim()
      ) || null,
    [patients, idNumber]
  );

  const [editablePatient, setEditablePatient] = useState(patient || null);

  useEffect(() => {
    setEditablePatient(patient || null);
  }, [patient]);

  if (!patient || !editablePatient) {
    return (
      <div className="app-container patient-details-page">
        <h1 className="app-title">Patient profile</h1>
        <p>Patient not found.</p>
        <button
          type="button"
          className="secondary-button"
          onClick={() => navigate("/patients")}
        >
          Back to patients list
        </button>
      </div>
    );
  }

  const fullName =
    selectedPatientFullName ||
    [editablePatient.firstName, editablePatient.lastName]
      .filter(Boolean)
      .join(" ");

  const updateField = (field, value) => {
    setEditablePatient((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      if (typeof onUpdatePatient === "function") {
        onUpdatePatient(updated);
      }
      return updated;
    });
  };

  const handleClose = () => {
    navigate("/patients");
  };

  const clinicalStatus = (editablePatient.clinicalStatus || "")
    .toString()
    .trim()
    .toLowerCase();

  const headerStatusClass =
    clinicalStatus === "active"
      ? "header-active"
      : clinicalStatus === "stable"
      ? "header-stable"
      : clinicalStatus === "disabled"
      ? "header-disabled"
      : clinicalStatus === "not active" ||
        clinicalStatus === "not-active" ||
        clinicalStatus === "notactive"
      ? "header-not-active"
      : "header-inactive";

  const statusPillClass =
    clinicalStatus === "active"
      ? "status-pill status-active"
      : clinicalStatus === "stable"
      ? "status-pill status-stable"
      : clinicalStatus === "disabled"
      ? "status-pill status-disabled"
      : clinicalStatus === "not active" ||
        clinicalStatus === "not-active" ||
        clinicalStatus === "notactive"
      ? "status-pill status-not-active"
      : "status-pill status-inactive";

  const initials = `${editablePatient.firstName?.[0] || "?"}${
    editablePatient.lastName?.[0] || ""
  }`.toUpperCase();

  const genderValue = (editablePatient.gender || "")
    .toString()
    .trim()
    .toLowerCase();

  const genderClass =
    genderValue === "female" || genderValue === "f"
      ? "avatar-female"
      : genderValue === "male" || genderValue === "m"
      ? "avatar-male"
      : "avatar-other";

  const handleSaveTranscriptionForPatient = (text, audioUrl) => {
    const targetId = editablePatient.idNumber;
    const cleanText = text?.trim() || "";
    const hasAudio = Boolean(audioUrl);

    if (!targetId) return;
    if (!cleanText && !hasAudio) return;

    if (typeof handleSelectPatient === "function") {
      handleSelectPatient(targetId);
    }

    handleSaveTranscription(targetId, cleanText, audioUrl || "");
  };

  const handleAddReportForPatient = (meta) => {
    if (typeof handleSelectPatient === "function") {
      handleSelectPatient(editablePatient.idNumber);
    }
    handleAddReport(editablePatient.idNumber, meta);
  };

  const handleExportClick = () => {
    if (typeof handleExportPatients === "function") {
      handleExportPatients();
    } else {
      alert("Export is not configured yet in the app.");
    }
  };

  const handleImportChange = (event) => {
    if (typeof handleImportPatients === "function") {
      handleImportPatients(event);
    } else {
      alert("Import is not configured yet in the app.");
    }
    if (event?.target) {
      event.target.value = "";
    }
  };

  const fullAddress =
    editablePatient.address ||
    [editablePatient.street, editablePatient.city, editablePatient.country]
      .filter(Boolean)
      .join(", ") ||
    "";

  return (
    <div className="app-container patient-details-page">
      {/* HEADER */}
      <div className={`patient-header-wrapper ${headerStatusClass}`}>
        <div className="patient-header-left">
          <div className={`patient-avatar-details ${genderClass}`}>
            {initials}
          </div>

          <div className="patient-header-title-block">
            <h1 className="patient-details-name">
              {fullName || "Unknown patient"}
            </h1>

            <div className="patient-details-meta">
              <span className="meta-chip">
                <strong>ID:</strong> {editablePatient.idNumber || "-"}
              </span>
              <span className="meta-chip">
                <strong>DOB:</strong> {editablePatient.dateOfBirth || "-"}
              </span>
              <span className="meta-chip">
                <strong>Gender:</strong> {editablePatient.gender || "Not set"}
              </span>
              <span className={statusPillClass}>
                {editablePatient.clinicalStatus || "Not Active"}
              </span>
            </div>
          </div>
        </div>

        <div className="patient-header-actions">
          <button
            type="button"
            className="header-chip-btn header-chip-close"
            onClick={handleClose}
          >
            Close
          </button>

          <button
            type="button"
            className="header-chip-btn"
            onClick={handleExportClick}
          >
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

      {/* PATIENT DETAILS CARD */}
      <section className="patient-card">
        <h2 className="section-title">Patient details</h2>

        <div className="patient-details-top-row">
          <div className="details-row-inline">
            <span className="details-label">Phone</span>
            <InlineEditable
              value={editablePatient.phone}
              placeholder="Add phone number"
              inputType="tel"
              onChange={(val) => updateField("phone", val)}
              className="details-value"
            />
          </div>

          <div className="details-row-inline">
            <span className="details-label">Email</span>
            <InlineEditable
              value={editablePatient.email}
              placeholder="Add email"
              onChange={(val) => updateField("email", val)}
              className="details-value"
            />
          </div>

          <div className="details-row-inline">
            <span className="details-label">Address</span>
            <InlineEditable
              value={fullAddress}
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

        <div className="section-with-field">
          <h3 className="section-subtitle">Medical issues</h3>
          <InlineEditable
            value={editablePatient.medicalIssues}
            placeholder="Chronic conditions, injuries, risk factors, operations"
            onChange={(val) => updateField("medicalIssues", val)}
            multiline
            className="details-box"
          />
        </div>

        <div className="section-with-field">
          <h3 className="section-subtitle">Notes</h3>
          <InlineEditable
            value={editablePatient.notes}
            placeholder="Write your notes here..."
            onChange={(val) => updateField("notes", val)}
            multiline
            className="details-box"
          />
        </div>
      </section>

      {/* TRANSCRIPTION CARD */}
      <section className="patient-card">
        <h2 className="section-title">Treatment transcription</h2>
        <RecordAudio
          selectedPatient={editablePatient}
          onSaveTranscription={handleSaveTranscriptionForPatient}
        />
      </section>

      {/* HISTORY CARD */}
      <section className="patient-card">
        <h2 className="section-title">History and reports</h2>
        <PatientHistory patient={editablePatient} />
        <AttachReports
          patientId={editablePatient.idNumber}
          existingReports={editablePatient.reports || []}
          onAddReport={handleAddReportForPatient}
          onDeleteReport={handleDeleteReport}
        />
      </section>
    </div>
  );
}

export default PatientDetailsPage;
