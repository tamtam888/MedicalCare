// src/App.jsx

import { useState, useEffect } from "react";
import PatientForm from "./components/PatientForm.jsx";
import PatientList from "./components/PatientList.jsx";
import "./App.css";

const STORAGE_KEY = "medicalcare_patients";

function App() {
  const [patients, setPatients] = useState([]);
  const [editingIdNumber, setEditingIdNumber] = useState(null);

  // Load patients from localStorage on first render
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPatients(parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load patients from storage:", error);
    }
  }, []);

  // Save patients to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    } catch (error) {
      console.error("Failed to save patients to storage:", error);
    }
  }, [patients]);

  const handleCreatePatient = (patientData) => {
    console.log("New patient created:", patientData);
    setPatients((prev) => [...prev, patientData]);
  };

  const handleStartEdit = (idNumber) => {
    console.log("Start editing patient with ID:", idNumber);
    setEditingIdNumber(idNumber);
  };

  const handleUpdatePatient = (updatedPatient) => {
    console.log("Updated patient:", updatedPatient);

    setPatients((prev) =>
      prev.map((p) =>
        p.idNumber === updatedPatient.idNumber ? updatedPatient : p
      )
    );

    setEditingIdNumber(null);
  };

  const handleCancelEdit = () => {
    setEditingIdNumber(null);
  };

  const editingPatient =
    editingIdNumber != null
      ? patients.find((p) => p.idNumber === editingIdNumber) || null
      : null;

  return (
    <div className="app-container">
      <img src="/icon.png" alt="MedicalCare Icon" className="app-logo" />

      <h1 className="app-title">
        Digital Patient Record - Create patient profile
      </h1>

      <section className="app-section">
        <PatientForm
          onCreatePatient={handleCreatePatient}
          onUpdatePatient={handleUpdatePatient}
          editingPatient={editingPatient}
          onCancelEdit={handleCancelEdit}
        />
      </section>

      <section className="app-section">
        <h2 className="section-title">Patients list</h2>
        <PatientList
          patients={patients}
          onEditPatient={handleStartEdit}
        />
      </section>
    </div>
  );
}

export default App;



