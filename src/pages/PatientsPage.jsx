// src/pages/PatientsPage.jsx
import { useNavigate } from "react-router-dom";
import PatientForm from "../components/PatientForm";
import PatientList from "../components/PatientList";
import PatientHistory from "../components/PatientHistory";
import AttachReports from "../components/AttachReports";
import RecordAudio from "../components/RecordAudio";

function PatientsPage({
  patients,
  selectedPatient,
  editingPatient,
  selectedPatientFullName,
  handleCreatePatient,
  handleUpdatePatient,
  handleDeletePatient,
  handleSelectPatient,
  handleEditPatient,
  handleAddReport,
  handleSaveTranscription,
  handleExportPatients,
  handleImportPatients,
  handleCancelEdit,
}) {
  const navigate = useNavigate();

  const handleSelectAndOpenDetails = (idNumber) => {
    if (!idNumber) return;
    handleSelectPatient(idNumber);
    navigate(`/patients/${idNumber}`);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const raw = event.target.elements.idNumberSearch.value || "";
    const trimmed = raw.trim();
    if (!trimmed) {
      return;
    }

    const exists = patients.some(
      (p) => String(p.idNumber) === String(trimmed)
    );

    if (!exists) {
      alert("No patient found with this ID number.");
      return;
    }

    handleSelectPatient(trimmed);
    navigate(`/patients/${trimmed}`);
    event.target.reset();
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Digital Patient Record</h1>

      <section className="app-section">
        <h2 className="section-title">
          {editingPatient ? "Edit patient profile" : "Create patient profile"}
        </h2>
        <PatientForm
          onCreatePatient={handleCreatePatient}
          onUpdatePatient={handleUpdatePatient}
          editingPatient={editingPatient}
          onCancelEdit={handleCancelEdit}
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">Patients</h2>

        <form className="patient-search" onSubmit={handleSearchSubmit}>
          <label className="patient-search-label">
            Search by ID number
            <input
              type="text"
              name="idNumberSearch"
              className="patient-search-input"
              placeholder="Enter ID number"
            />
          </label>
          <button type="submit" className="secondary-button">
            View patient
          </button>
        </form>

        <PatientList
          patients={patients}
          onEditPatient={handleEditPatient}
          onDeletePatient={handleDeletePatient}
          onSelectPatient={handleSelectAndOpenDetails}
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">Export and import</h2>
        <div className="export-import-controls">
          <button
            type="button"
            className="primary-button"
            onClick={handleExportPatients}
          >
            Export patients (FHIR JSON)
          </button>

          <label className="import-label">
            Import patients
            <input
              type="file"
              accept="application/json"
              onChange={handleImportPatients}
            />
          </label>
        </div>
      </section>

      <section className="app-section">
        <h2 className="section-title">Treatment transcription</h2>
        <RecordAudio
          selectedPatient={selectedPatient}
          onSaveTranscription={handleSaveTranscription}
        />
      </section>

      {selectedPatient && (
        <section className="app-section">
          <h2 className="section-title">
            Patient history and reports - {selectedPatientFullName}
          </h2>

          <PatientHistory patient={selectedPatient} />

          <AttachReports
            patientId={selectedPatient.idNumber}
            existingReports={selectedPatient.reports || []}
            onAddReport={handleAddReport}
          />
        </section>
      )}
    </div>
  );
}

export default PatientsPage;
