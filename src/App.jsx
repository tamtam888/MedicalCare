// src/App.jsx
import { useEffect, useState } from "react";
import PatientForm from "./components/PatientForm";
import PatientList from "./components/PatientList";
import PatientHistory from "./components/PatientHistory";
import AttachReports from "./components/AttachReports";
import "./App.css";

const STORAGE_KEY = "patients";

function App() {
  // Load patients once from localStorage on first render
  const [patients, setPatients] = useState(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const parsed = JSON.parse(stored);

      const normalized = parsed.map((p) => ({
        ...p,
        history: Array.isArray(p.history) ? p.history : [],
        reports: Array.isArray(p.reports) ? p.reports : [],
      }));

      return normalized;
    } catch (error) {
      console.error("Failed to parse patients from localStorage", error);
      return [];
    }
  });

  const [editingPatient, setEditingPatient] = useState(null);
  const [selectedPatientIdNumber, setSelectedPatientIdNumber] = useState(null);

  // Persist patients to localStorage whenever they change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(patients));
    } catch (error) {
      console.error("Failed to save patients to localStorage", error);
    }
  }, [patients]);

  const selectedPatient =
    patients.find((p) => p.idNumber === selectedPatientIdNumber) || null;

  const handleCreatePatient = (formData) => {
    const createdAt = new Date().toISOString();
    const idNumber = String(formData.idNumber).trim();

    // Prevent duplicate ID numbers
    const exists = patients.some(
      (p) => String(p.idNumber).trim() === idNumber
    );
    if (exists) {
      alert("A patient with this ID number already exists.");
      return;
    }

    const newPatient = {
      ...formData,
      idNumber,
      history: [
        {
          id: crypto.randomUUID(),
          type: "Note",
          title: "Patient profile created",
          date: createdAt,
          summary: "Initial patient profile was created in the system.",
        },
      ],
      reports: [],
    };

    setPatients((prev) => [...prev, newPatient]);
    setSelectedPatientIdNumber(idNumber);
    setEditingPatient(null);
  };

  const handleUpdatePatient = (updatedData) => {
    if (!editingPatient) return;

    const newIdNumber = String(updatedData.idNumber).trim();
    const oldIdNumber = String(editingPatient.idNumber).trim();

    // If ID number changed, ensure uniqueness
    if (newIdNumber !== oldIdNumber) {
      const exists = patients.some(
        (p) => String(p.idNumber).trim() === newIdNumber
      );
      if (exists) {
        alert("Another patient already uses this ID number.");
        return;
      }
    }

    setPatients((prev) =>
      prev.map((p) =>
        p.idNumber === editingPatient.idNumber
          ? {
              ...p,
              ...updatedData,
              idNumber: newIdNumber,
              history: Array.isArray(p.history) ? p.history : [],
              reports: Array.isArray(p.reports) ? p.reports : [],
            }
          : p
      )
    );

    setEditingPatient(null);
    setSelectedPatientIdNumber(newIdNumber);
  };

  const handleCancelEdit = () => {
    setEditingPatient(null);
  };

  const handleEditPatient = (idNumber) => {
    const patient = patients.find((p) => p.idNumber === idNumber);
    if (!patient) return;

    setEditingPatient(patient);
    setSelectedPatientIdNumber(idNumber);
  };

  const handleDeletePatient = (idNumber) => {
    setPatients((prev) => prev.filter((p) => p.idNumber !== idNumber));

    if (selectedPatientIdNumber === idNumber) {
      setSelectedPatientIdNumber(null);
    }

    if (editingPatient && editingPatient.idNumber === idNumber) {
      setEditingPatient(null);
    }
  };

  const handleSelectPatient = (idNumber) => {
    setSelectedPatientIdNumber(idNumber);
  };

  const handleAddReport = (idNumber, reportMeta) => {
    setPatients((prev) =>
      prev.map((p) => {
        if (p.idNumber !== idNumber) return p;

        const reports = [...(p.reports || []), reportMeta];

        const historyEntry = {
          id: reportMeta.id,
          type: "Report",
          title: `Report attached: ${reportMeta.name}`,
          date: reportMeta.uploadedAt,
          summary: "PDF report was attached to the patient profile.",
        };

        const history = [...(p.history || []), historyEntry];

        return { ...p, reports, history };
      })
    );
  };

  return (
    <div className="app-container">
      <img src="/icon.png" alt="MedicalCare Icon" className="app-logo" />

      <h1 className="app-title">
        Digital Patient Record - Create patient profile
      </h1>

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
        <PatientList
          patients={patients}
          onEditPatient={handleEditPatient}
          onDeletePatient={handleDeletePatient}
          onSelectPatient={handleSelectPatient}
        />
      </section>

      {selectedPatient && (
        <section className="app-section">
          <h2 className="section-title">
            Patient history and reports -{" "}
            {selectedPatient.firstName} {selectedPatient.lastName}
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

export default App;
