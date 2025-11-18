// src/App.jsx

import { useState } from "react";
import PatientForm from "./components/PatientForm";
import "./App.css";

// Main application component - manages global patient state
function App() {
  const [patients, setPatients] = useState([]);

  // Add a new patient to the list
  const handleCreatePatient = (newPatientData) => {
    const patientWithId = {
      id: crypto.randomUUID(),
      ...newPatientData,
    };

    console.log("New patient created:", patientWithId);

    setPatients((prev) => [...prev, patientWithId]);
  };

  return (
    <div className="app-container">
      <h1 className="app-title">Digital Patient Record - Create patient profile</h1>

      <section className="app-section">
        <PatientForm onCreatePatient={handleCreatePatient} />
      </section>

      <section className="app-section">
        <h2 className="section-title">Patients list</h2>
        {patients.length === 0 ? (
          <p>No patients yet.</p>
        ) : (
          <ul className="patients-list">
            {patients.map((p) => (
              <li key={p.id} className="patients-item">
                <span className="patients-item-main">
                  {p.firstName} {p.lastName}
                </span>
                <span className="patients-item-sub">
                  {p.dateOfBirth} {p.gender && `- ${p.gender}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export default App;
