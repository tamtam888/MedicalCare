<<<<<<< HEAD
import { useMemo, useRef, useState } from "react";
=======
import { useMemo, useState, useEffect } from "react";
>>>>>>> refactor-ui-cleanup
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
<<<<<<< HEAD
  const [draft, setDraft] = useState("");

  const startEditing = () => {
    setDraft(value ?? "");
    setEditing(true);
  };
=======
  const [draft, setDraft] = useState(value || "");

  useEffect(() => {
    if (!editing) setDraft(value || "");
  }, [value, editing]);
>>>>>>> refactor-ui-cleanup

  const finish = () => {
    setEditing(false);
    const next = draft ?? "";
<<<<<<< HEAD
    if (next !== (value ?? "")) {
      onChange(next);
    }
=======
    if (next !== (value ?? "")) onChange(next);
>>>>>>> refactor-ui-cleanup
  };

  if (!editing) {
    return (
<<<<<<< HEAD
      <span className={`editable-field ${className}`} onClick={startEditing}>
=======
      <span
        className={`editable-field ${className}`}
        onClick={() => setEditing(true)}
      >
>>>>>>> refactor-ui-cleanup
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

<<<<<<< HEAD
=======
function pickFirstAddress(address) {
  if (!address) return null;
  if (Array.isArray(address)) return address[0] ?? null;
  if (typeof address === "object") return address;
  return null;
}

function buildAddressString(patient) {
  const addrObj = pickFirstAddress(patient?.address);
  const street =
    patient?.street ||
    addrObj?.street ||
    addrObj?.line1 ||
    (Array.isArray(addrObj?.line) ? addrObj.line[0] : "") ||
    "";

  const city = patient?.city || addrObj?.city || addrObj?.town || "";
  const country = patient?.country || addrObj?.country || "";

  return [street, city, country].filter(Boolean).join(", ");
}

>>>>>>> refactor-ui-cleanup
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

<<<<<<< HEAD
  const patient = useMemo(
    () =>
      patients.find(
        (p) =>
          p.idNumber &&
          p.idNumber.toString().trim() === String(idNumber).trim()
      ) || null,
    [patients, idNumber]
  );

  const patientKey = patient?.idNumber ? String(patient.idNumber).trim() : "";

  const overridesRef = useRef(new Map());
  const [renderTick, setRenderTick] = useState(0);

  const editablePatient = useMemo(() => {
    if (!patient) return null;
    const overrides = overridesRef.current.get(patientKey) || {};
    return { ...patient, ...overrides };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, patientKey, renderTick]);

  const updateField = (field, value) => {
    if (!patient) return;

    const current = overridesRef.current.get(patientKey) || {};
    const nextOverrides = { ...current, [field]: value };
    overridesRef.current.set(patientKey, nextOverrides);

    const updated = { ...patient, ...nextOverrides };
    if (typeof onUpdatePatient === "function") {
      onUpdatePatient(updated);
    }

    setRenderTick((t) => t + 1);
  };

  const handleClose = () => {
    navigate("/patients");
  };

  const handleSaveTranscriptionForPatient = (text, audioUrl) => {
    const targetId = editablePatient?.idNumber;
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
    if (!editablePatient?.idNumber) return;

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
=======
  const patient = useMemo(() => {
    const idTrim = String(idNumber ?? "").trim();
    return (
      patients.find((p) => String(p?.idNumber ?? "").trim() === idTrim) || null
    );
  }, [patients, idNumber]);

  const [editablePatient, setEditablePatient] = useState(patient || null);

  useEffect(() => {
    setEditablePatient(patient || null);
  }, [patient]);
>>>>>>> refactor-ui-cleanup

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

<<<<<<< HEAD
=======
  const updateField = (field, value) => {
    setEditablePatient((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, [field]: value };
      onUpdatePatient?.(updated);
      return updated;
    });
  };

  const updateAddressFromInput = (input) => {
    const street = (input || "").trim();

    setEditablePatient((prev) => {
      if (!prev) return prev;

      const prevAddrObj = pickFirstAddress(prev.address) || {};
      const city = prev.city || prevAddrObj.city || prevAddrObj.town || "";
      const zipCode =
        prev.zipCode ||
        prevAddrObj.zipCode ||
        prevAddrObj.postalCode ||
        "";

      const addressObj = {
        ...prevAddrObj,
        street,
        city,
        postalCode: zipCode,
      };

      const updated = {
        ...prev,
        street,
        city,
        zipCode,
        address: [addressObj],
      };

      onUpdatePatient?.(updated);
      return updated;
    });
  };

  const updateHistory = (nextHistory) => {
    setEditablePatient((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        history: Array.isArray(nextHistory) ? nextHistory : [],
      };
      onUpdatePatient?.(updated);
      return updated;
    });
  };

  const handleClose = () => {
    navigate("/patients");
  };

>>>>>>> refactor-ui-cleanup
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

<<<<<<< HEAD
  const fullAddress =
    editablePatient.address ||
    [editablePatient.street, editablePatient.city, editablePatient.country]
      .filter(Boolean)
      .join(", ") ||
    "";
=======
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

  const fullAddress = buildAddressString(editablePatient);
>>>>>>> refactor-ui-cleanup

  return (
    <div className="app-container patient-details-page">
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
<<<<<<< HEAD
              onChange={(val) => updateField("address", val)}
=======
              onChange={updateAddressFromInput}
>>>>>>> refactor-ui-cleanup
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
<<<<<<< HEAD
            placeholder="Write your notes here..."
=======
            placeholder="Write your notes here."
>>>>>>> refactor-ui-cleanup
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
<<<<<<< HEAD
        <PatientHistory patient={editablePatient} />
=======
        <PatientHistory
          patient={editablePatient}
          history={editablePatient.history}
          onChangeHistory={updateHistory}
        />
>>>>>>> refactor-ui-cleanup
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
