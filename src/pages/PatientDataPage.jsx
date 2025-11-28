// src/pages/PatientDataPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PatientList from "../components/PatientList";
import PatientHistory from "../components/PatientHistory";
import AttachReports from "../components/AttachReports";
import RecordAudio from "../components/RecordAudio";

function PatientDataPage({
  patients,
  selectedPatient,
  selectedPatientFullName,
  handleSelectPatient,
  handleEditPatient,
  handleDeletePatient,
  handleAddReport,
  handleSaveTranscription,
  handleExportPatients,
  handleImportPatients,
}) {
  const [searchId, setSearchId] = useState("");
  const navigate = useNavigate();

  const trimmedSearch = searchId.trim();

  const filteredPatients = trimmedSearch
    ? patients.filter(
        (p) =>
          p.idNumber &&
          p.idNumber.toString().includes(trimmedSearch)
      )
    : patients;

  const openPatientDetails = (idNumber) => {
    if (!idNumber) return;
    handleSelectPatient(idNumber);
    navigate(`/patients/${idNumber}`);
  };

  const openEditForm = (idNumber) => {
    if (!idNumber) return;
    handleEditPatient(idNumber);
    navigate("/patients");
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    if (!trimmedSearch) {
      return;
    }

    const found = patients.find(
      (p) => p.idNumber && p.idNumber.toString() === trimmedSearch
    );

    if (found) {
      openPatientDetails(found.idNumber);
    } else {
      alert("No patient found with this ID number.");
    }
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Patient data</h1>

      <section className="app-section">
        <h2 className="section-title">Search patient by ID</h2>
        <form className="patient-search-form" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className="text-input"
            placeholder="Enter ID number"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button type="submit" className="primary-button">
            Find patient
          </button>
        </form>
      </section>

      <section className="app-section">
        <h2 className="section-title">Patient list</h2>
        <PatientList
          patients={filteredPatients}
          onEditPatient={openEditForm}
          onDeletePatient={handleDeletePatient}
          onSelectPatient={openPatientDetails}
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">Export and import patients</h2>
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

export default PatientDataPage;

