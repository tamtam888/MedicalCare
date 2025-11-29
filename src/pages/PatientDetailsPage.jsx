// src/pages/PatientDetailsPage.jsx
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

  const handleClick = () => {
    setEditing(true);
  };

  const finish = () => {
    setEditing(false);
    const next = draft;
    if (next !== value) {
      onChange(next);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !multiline) {
      event.preventDefault();
      finish();
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDraft(value || "");
      setEditing(false);
    }
  };

  if (!editing) {
    return (
      <span
        className={`editable-field ${className}`}
        onClick={handleClick}
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
        onChange={(e) => setDraft(e.target.value)}
        onBlur={finish}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <input
      type={inputType}
      className={`inline-input ${className}`}
      value={draft}
      autoFocus
      onChange={(e) => setDraft(e.target.value)}
      onBlur={finish}
      onKeyDown={handleKeyDown}
    />
  );
}

function PatientDetailsPage({
  patients,
  selectedPatient,
  selectedPatientFullName,
  handleSelectPatient,
  handleAddReport,
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
          onClick={() => navigate("/data/patient")}
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
    navigate("/data/patient");
  };

  // תמלול - עכשיו תומך גם ב audioUrl אם RecordAudio מעבירה אותו
  const handleSaveTranscriptionForPatient = (id, text, audioUrl) => {
    const targetId = id || editablePatient.idNumber;
    const cleanText = text?.trim() || "";
    const hasAudio = Boolean(audioUrl);

    if (!targetId) return;
    if (!cleanText && !hasAudio) return;

    handleSelectPatient(targetId);
    // ב usePatients עדכנו את handleSaveTranscription לקבל גם audioUrl
    handleSaveTranscription(targetId, cleanText, audioUrl);
  };

  const handleAddReportForPatient = (meta) => {
    handleSelectPatient(editablePatient.idNumber);
    handleAddReport(editablePatient.idNumber, meta);
  };

  const handleExportClick = () => {
    if (typeof handleExportPatients === "function") {
      // כרגע הפונקציה מייצאת את כל המטופלים כמקשה אחת
      // זה מערב את המטופל הזה עם כל השאר, אבל משתמשת באותה לוגיקה של usePatients
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
    // איפוס כדי שאפשר יהיה לבחור שוב את אותו קובץ אם צריך
    if (event?.target) {
      event.target.value = "";
    }
  };

  return (
    <div className="app-container patient-details-page">
      <header className="patient-details-header">
        <div className="patient-details-title-block">
          <h1 className="app-title patient-details-title">
            Patient profile - {fullName || "Unknown"}
          </h1>

          <div className="patient-details-meta">
            <span className="meta-item">
              <strong>ID number:</strong> {editablePatient.idNumber || "-"}
            </span>
            <span className="meta-item">
              <strong>Date of birth:</strong>{" "}
              {editablePatient.dateOfBirth || "-"}
            </span>
            <span className="meta-item">
              <strong>Gender:</strong>{" "}
              <select
                className="inline-select"
                value={editablePatient.gender || ""}
                onChange={(e) => updateField("gender", e.target.value)}
              >
                <option value="">Not set</option>
                <option value="male">male</option>
                <option value="female">female</option>
                <option value="other">other</option>
              </select>
            </span>
          </div>
        </div>

        <div className="patient-details-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleClose}
          >
            Close
          </button>

          <button
            type="button"
            className="primary-button outline export-single-button"
            onClick={handleExportClick}
          >
            Export patient (FHIR JSON)
          </button>

          <label className="import-single-label">
            <span className="import-single-text">Import patient</span>
            <input
              type="file"
              accept="application/json"
              className="import-single-input"
              onChange={handleImportChange}
            />
          </label>
        </div>
      </header>

      <section className="patient-card">
        <h2 className="section-title">Patient details</h2>

        <div className="patient-details-grid">
          <div className="details-row">
            <span className="details-label">Phone</span>
            <InlineEditable
              value={editablePatient.phone}
              placeholder="Add phone number"
              inputType="tel"
              onChange={(val) => updateField("phone", val)}
              className="details-value"
            />
          </div>

          <div className="details-row">
            <span className="details-label">Email</span>
            <InlineEditable
              value={editablePatient.email}
              placeholder="📧 Add email"
              onChange={(val) => updateField("email", val)}
              className="details-value"
            />
          </div>

          <div className="details-row">
            <span className="details-label">Address</span>
            <InlineEditable
              value={editablePatient.address}
              placeholder="Street and number, city and country"
              onChange={(val) => updateField("address", val)}
              className="details-value"
            />
          </div>
        </div>

        <div className="status-row">
          <span className="details-label">Clinical status</span>
          <select
            className="inline-input details-value"
            value={editablePatient.clinicalStatus || ""}
            onChange={(e) =>
              updateField("clinicalStatus", e.target.value)
            }
          >
            <option value="">Not active</option>
            <option value="Active">Active</option>
            <option value="In treatment">In treatment</option>
            <option value="Stable">Stable</option>
            <option value="Discharged">Discharged</option>
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
            placeholder="📝 Write your notes here..."
            onChange={(val) => updateField("notes", val)}
            multiline
            className="details-box"
          />
        </div>
      </section>

      <section className="patient-card">
        <h2 className="section-title">Treatment transcription</h2>
        <RecordAudio
          selectedPatient={editablePatient}
          onSaveTranscription={handleSaveTranscriptionForPatient}
        />
      </section>

      <section className="patient-card">
        <h2 className="section-title">History and reports</h2>
        <PatientHistory patient={editablePatient} />
        <AttachReports
          patientId={editablePatient.idNumber}
          existingReports={editablePatient.reports || []}
          onAddReport={handleAddReportForPatient}
        />
      </section>
    </div>
  );
}

export default PatientDetailsPage;
