// src/App.jsx
import { useState, useEffect } from "react";
import PatientForm from "./components/PatientForm.jsx";
import PatientList from "./components/PatientList.jsx";
import "./App.css";

const STORAGE_KEY = "medicalcare_patients";

function App() {
  const [patients, setPatients] = useState([]);
  const [editingIdNumber, setEditingIdNumber] = useState(null);
  const [hasLoadedFromStorage, setHasLoadedFromStorage] = useState(false);

  // טעינת מטופלים מה localStorage בטעינה ראשונית
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPatients(parsed);
          console.log("Loaded patients from storage:", parsed);
        }
      }
    } catch (error) {
      console.error("Failed to load patients from storage:", error);
    } finally {
      // מסמן שסיימנו את ניסיון הטעינה
      setHasLoadedFromStorage(true);
    }
  }, []);

  // שמירת מטופלים ל localStorage רק אחרי שהטעינה הסתיימה
  useEffect(() => {
    if (!hasLoadedFromStorage) {
      // לא שומרים לפני שסיימנו לטעון מהאחסון
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
      console.log("Saved patients to storage:", patients);
    } catch (error) {
      console.error("Failed to save patients to storage:", error);
    }
  }, [patients, hasLoadedFromStorage]);

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

  const handleDeletePatient = (idNumber) => {
    console.log("Deleting patient with ID:", idNumber);
    setPatients((prev) => prev.filter((p) => p.idNumber !== idNumber));

    setEditingIdNumber((current) =>
      current === idNumber ? null : current
    );
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
          onDeletePatient={handleDeletePatient}
        />
      </section>
    </div>
  );
}

export default App;
