// src/pages/PatientDetailsPage.jsx
import { useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import PatientDetails from "../components/PatientDetails";
import PatientHistory from "../components/PatientHistory";
import AttachReports from "../components/AttachReports";
import RecordAudio from "../components/RecordAudio";

function PatientDetailsPage({
  patients,
  selectedPatient,
  selectedPatientFullName,
  handleSelectPatient,
  handleAddReport,
  handleSaveTranscription,
  handleEditPatient,
}) {
  const { idNumber } = useParams();
  const navigate = useNavigate();

  useEffect(() => {
    if (idNumber) {
      handleSelectPatient(idNumber);
    }
  }, [idNumber, handleSelectPatient]);

  const patient =
    selectedPatient ||
    patients.find((p) => String(p.idNumber) === String(idNumber)) ||
    null;

  if (!patient) {
    return (
      <div className="app-container">
        <h1 className="app-title">Patient not found</h1>
        <p className="page-placeholder-text">
          No patient was found with ID {idNumber}.
        </p>
        <button
          type="button"
          className="primary-button"
          onClick={() => navigate("/patients")}
        >
          Back to patients
        </button>
      </div>
    );
  }

  const fullName =
    [patient.firstName, patient.lastName].filter(Boolean).join(" ") ||
    selectedPatientFullName;

  const handleClose = () => {
    navigate("/patients");
  };

  const handleEdit = () => {
    handleEditPatient(patient.idNumber);
    navigate("/patients");
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Patient profile - {fullName}</h1>

      <section className="app-section">
        <PatientDetails
          patient={patient}
          onClose={handleClose}
          onEdit={handleEdit}
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">Treatment transcription</h2>
        <RecordAudio
          selectedPatient={patient}
          onSaveTranscription={(text) =>
            handleSaveTranscription(patient.idNumber, text)
          }
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">History and reports</h2>
        <PatientHistory patient={patient} />
        <AttachReports
          patientId={patient.idNumber}
          existingReports={patient.reports || []}
          onAddReport={handleAddReport}
        />
      </section>

      <section className="app-section">
        <Link to="/patients" className="secondary-link">
          ← Back to patients list
        </Link>
      </section>
    </div>
  );
}

export default PatientDetailsPage;
