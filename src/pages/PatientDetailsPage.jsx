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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  selectedPatientFullName,
  handleSelectPatient,
  handleAddReport,
  handleDeleteReport,
  handleSaveTranscription,
  onUpdatePatient,
  handleExportPatients,
  handleImportPatients,
}) {
  const { idNumber } = useParams();
  const navigate = useNavigate();

  const patient = useMemo(() => {
    if (!idNumber || !patients) return null;
    const trimmedId = String(idNumber).trim();
    if (!trimmedId) return null;
    
    const found = patients.find(
      (p) => p && p.idNumber && String(p.idNumber).trim() === trimmedId
    );
    
    if (import.meta.env.DEV && !found && patients.length > 0) {
      console.warn(
        `[PatientDetailsPage] Patient not found: ${trimmedId}. Available IDs:`,
        patients.map((p) => p?.idNumber).filter(Boolean)
      );
    }
    
    return found || null;
  }, [patients, idNumber]);

  const [editablePatient, setEditablePatient] = useState(null);

  useEffect(() => {
    if (patient) {
      // Use setTimeout to avoid synchronous setState in effect
      const timer = setTimeout(() => {
        setEditablePatient(patient);
      }, 0);
      return () => clearTimeout(timer);
    }
    
    // If patient is not found but we have patients, wait a bit for state to update
    if (patients && patients.length > 0) {
      const timer = setTimeout(() => {
        const trimmedId = String(idNumber).trim();
        const found = patients.find(
          (p) => p && p.idNumber && String(p.idNumber).trim() === trimmedId
        );
        if (found) {
          setEditablePatient(found);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [patient, patients, idNumber]);

  // Show loading state if patients array exists but patient not found yet
  if (patients && patients.length > 0 && !patient && !editablePatient) {
    return (
      <div className="app-container patient-details-page">
        <h1 className="app-title">Patient profile</h1>
        <p>Loading patient data...</p>
      </div>
    );
  }

  if (!patient && !editablePatient) {
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

  // Use editablePatient as the source of truth
  const currentPatient = editablePatient || patient;

  const fullName =
    selectedPatientFullName ||
    [currentPatient.firstName, currentPatient.lastName]
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

  const handleSaveTranscriptionForPatient = (id, text, audioUrl) => {
    const targetId = id || currentPatient.idNumber;
    const cleanText = text?.trim() || "";
    const hasAudio = Boolean(audioUrl);

    if (!targetId) return;
    if (!cleanText && !hasAudio) return;

    handleSelectPatient(targetId);
    handleSaveTranscription(targetId, cleanText, audioUrl);
  };

  const handleAddReportForPatient = (meta) => {
    handleSelectPatient(currentPatient.idNumber);
    handleAddReport(currentPatient.idNumber, meta);
  };

  const handleDeleteReportForPatient = (reportId) => {
    if (typeof handleDeleteReport === "function") {
      handleDeleteReport(currentPatient.idNumber, reportId);
    }
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

  return (
    <div className="app-container patient-details-page">
      <header className="patient-details-header">
        <div className="patient-details-title-block">
          <h1 className="app-title patient-details-title">
            {fullName || "Unknown"}
          </h1>

          <div className="patient-details-meta">
            <span className="meta-item">
              <strong>ID number:</strong> {currentPatient.idNumber || "-"}
            </span>
            <span className="meta-item">
              <strong>Date of birth:</strong>{" "}
              {currentPatient.dateOfBirth || "-"}
            </span>
            <span className="meta-item">
              <strong>Gender:</strong>{" "}
              <select
                className="inline-select"
                value={currentPatient.gender || ""}
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
            <strong className="details-label">Phone</strong>
            <InlineEditable
              value={currentPatient.phone}
              placeholder="Add phone number"
              inputType="tel"
              onChange={(val) => updateField("phone", val)}
              className="details-value"
            />
          </div>

          <div className="details-row">
            <strong className="details-label">Email</strong>
            <InlineEditable
              value={currentPatient.email}
              placeholder="📧 Add email"
              onChange={(val) => updateField("email", val)}
              className="details-value"
            />
          </div>

          <div className="details-row">
            <strong className="details-label">Address</strong>
            <InlineEditable
              value={currentPatient.address}
              placeholder="Street and number, city and country"
              onChange={(val) => updateField("address", val)}
              className="details-value"
            />
          </div>
        </div>

        <div className="status-row">
          <strong className="details-label">Clinical status</strong>
          <select
            className="inline-input details-value"
            value={currentPatient.clinicalStatus || ""}
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
          <strong className="section-subtitle">Medical issues</strong>
          <InlineEditable
            value={currentPatient.medicalIssues}
            placeholder="Chronic conditions, injuries, risk factors, operations"
            onChange={(val) => updateField("medicalIssues", val)}
            multiline
            className="details-box"
          />
        </div>

        <div className="section-with-field">
          <strong className="section-subtitle">Notes</strong>
          <InlineEditable
            value={currentPatient.notes}
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
          selectedPatient={currentPatient}
          onSaveTranscription={handleSaveTranscriptionForPatient}
        />
      </section>

      <section className="patient-card">
        <h2 className="section-title">History and reports</h2>
        <PatientHistory patient={currentPatient} />
        <AttachReports
          patientId={currentPatient.idNumber}
          existingReports={currentPatient.reports || []}
          onAddReport={handleAddReportForPatient}
          onDeleteReport={handleDeleteReportForPatient}
        />
      </section>
    </div>
  );
}

export default PatientDetailsPage;
