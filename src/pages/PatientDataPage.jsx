// src/pages/PatientDataPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import PatientList from "../components/PatientList";
import "./PatientDataPage.css";

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
    navigate(`/patients/${idNumber}`);
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
    <div className="patient-data-page app-container">
      <header className="patient-data-header">
        <h1 className="app-title patient-data-title">Patient data</h1>
        <p className="patient-data-subtitle">
          Search, view and manage patient records
        </p>
      </header>

      {/* Search by ID */}
      <section className="app-section patient-data-section">
        <h2 className="section-title">Search patient by ID</h2>
        <form className="patient-search-form" onSubmit={handleSearchSubmit}>
          <input
            type="text"
            className="text-input patient-search-input"
            placeholder="Enter ID number"
            value={searchId}
            onChange={(e) => setSearchId(e.target.value)}
          />
          <button type="submit" className="primary-button patient-search-button">
            Find patient
          </button>
        </form>
      </section>

      {/* Patient list */}
      <section className="app-section patient-data-section">
        <div className="patient-data-section-header">
          <h2 className="section-title">Patient list</h2>
          {filteredPatients && filteredPatients.length > 0 && (
            <span className="patient-count">
              {filteredPatients.length} patients
            </span>
          )}
        </div>

        <PatientList
          patients={filteredPatients}
          onDeletePatient={handleDeletePatient}
          onSelectPatient={openPatientDetails}
        />
      </section>

      {/* Export and import */}
      <section className="app-section patient-data-section">
        <h2 className="section-title">Export and import patients</h2>
        <p className="patient-data-helper-text">
          Export all patients as FHIR JSON or import patients from another
          system.
        </p>

        <div className="export-import-controls">
          <button
            type="button"
            className="primary-button export-button"
            onClick={handleExportPatients}
          >
            Export patients (FHIR JSON)
          </button>

          <label className="import-label">
            <span className="import-label-text">Import patients</span>
            <input
              type="file"
              accept="application/json"
              onChange={handleImportPatients}
              className="import-input"
            />
          </label>
        </div>
      </section>
    </div>
  );
}

export default PatientDataPage;
