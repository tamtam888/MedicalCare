// src/pages/PatientDetailsPage.jsx
import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import PatientHistory from "../components/PatientHistory";
import AttachReports from "../components/AttachReports";
import RecordAudio from "../components/RecordAudio";

function PatientDetailsPage({
  patients,
  handleSelectPatient,
  handleAddReport,
  handleSaveTranscription,
  handleEditPatient,
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

  if (!patient) {
    return (
      <div className="app-container">
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

  const fullName = [patient.firstName, patient.lastName]
    .filter(Boolean)
    .join(" ");

  const handleClose = () => {
    navigate("/data/patient");
  };

  const handleEditProfile = () => {
    handleEditPatient(patient.idNumber);
    navigate("/patients");
  };

  // שמירת תמלול - מקבל גם id וגם טקסט מ-RecordAudio
  const handleSaveTranscriptionForPatient = (id, text) => {
    if (!id || !text || !text.trim()) return;
    handleSelectPatient(id);
    handleSaveTranscription(id, text);
  };

  // שמירת דוח - נשאר כמו שהיה, רק לוודא בחירה של המטופל
  const handleAddReportForPatient = (meta) => {
    handleSelectPatient(patient.idNumber);
    handleAddReport(patient.idNumber, meta);
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Patient profile - {fullName}</h1>

      <section className="patient-details-header">
        <div className="patient-details-row">
          <div>
            <strong>ID number:</strong> {patient.idNumber || "-"}
          </div>
          <div>
            <strong>Date of birth:</strong> {patient.dateOfBirth || "-"}
          </div>
          <div>
            <strong>Gender:</strong> {patient.gender || "-"}
          </div>
          <div>
            <strong>Phone:</strong> {patient.phone || "-"}
          </div>
        </div>

        <div className="patient-details-row">
          <div>
            <strong>Email:</strong> {patient.email || "-"}
          </div>
          <div>
            <strong>Address:</strong> {patient.address || "-"}
          </div>
          <div>
            <strong>Clinical status:</strong> {patient.clinicalStatus || "-"}
          </div>
        </div>

        <div className="patient-details-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={handleEditProfile}
          >
            Edit profile
          </button>
          <button
            type="button"
            className="secondary-button"
            onClick={handleClose}
          >
            Close
          </button>
        </div>
      </section>

      <section className="app-section">
        <h2 className="section-title">Medical issues</h2>
        <div className="details-box">
          {patient.medicalIssues || "No medical issues documented."}
        </div>
      </section>

      <section className="app-section">
        <h2 className="section-title">Notes</h2>
        <div className="details-box">
          {patient.notes || "No notes yet."}
        </div>
      </section>

      <section className="app-section">
        <h2 className="section-title">Treatment transcription</h2>
        <RecordAudio
          selectedPatient={patient}
          onSaveTranscription={handleSaveTranscriptionForPatient}
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">History and reports</h2>
        <PatientHistory patient={patient} />

        <AttachReports
          patientId={patient.idNumber}
          existingReports={patient.reports || []}
          onAddReport={handleAddReportForPatient}
        />
      </section>
    </div>
  );
}

export default PatientDetailsPage;
