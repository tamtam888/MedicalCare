// src/App.jsx
import { Routes, Route, Navigate } from "react-router-dom";
import { usePatients } from "./hooks/usePatients";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailsPage from "./pages/PatientDetailsPage";
import Sidebar from "./components/Sidebar";
import "./App.css";

function SimplePage({ title, text }) {
  return (
    <div className="page-placeholder">
      <h1 className="page-placeholder-title">{title}</h1>
      <p className="page-placeholder-text">{text}</p>
    </div>
  );
}

function App() {
  const patientsState = usePatients();

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main-area">
        <header className="app-header">
          <div className="app-header-right">
            <button type="button" className="header-icon-button" title="Settings">
              ⚙️
            </button>
            <button type="button" className="primary-button">
              Connect to Medplum
            </button>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route
              path="/dashboard"
              element={<DashboardPage patients={patientsState.patients} />}
            />

            <Route
              path="/patients"
              element={
                <PatientsPage
                  patients={patientsState.patients}
                  onAddPatient={patientsState.handleAddPatient}
                  onUpdatePatient={patientsState.handleUpdatePatient}
                  onDeletePatient={patientsState.handleDeletePatient}
                  onImportPatients={patientsState.handleImportPatients}
                  onExportPatients={patientsState.handleExportPatients}
                  onSelectPatient={patientsState.handleSelectPatient}
                />
              }
            />

            <Route
              path="/patients/:idNumber"
              element={
                <PatientDetailsPage
                  patients={patientsState.patients}
                  selectedPatient={patientsState.selectedPatient}
                  selectedPatientFullName={patientsState.selectedPatientFullName}
                  handleSelectPatient={patientsState.handleSelectPatient}
                  handleAddReport={patientsState.handleAddReport}
                  handleDeleteReport={patientsState.handleDeleteReport}
                  handleSaveTranscription={patientsState.handleSaveTranscription}
                  handleEditPatient={patientsState.handleEditPatient}
                  onUpdatePatient={patientsState.handleUpdatePatientInline}
                  handleExportPatients={patientsState.handleExportPatients}
                  handleImportPatients={patientsState.handleImportPatients}
                />
              }
            />

            <Route
              path="/data/care-plan"
              element={<SimplePage title="Care plans" text="Care plan data view. (Coming soon)" />}
            />
            <Route
              path="/data/appointment"
              element={
                <SimplePage title="Appointments data" text="Appointment data view. (Coming soon)" />
              }
            />
            <Route
              path="/analytics"
              element={<SimplePage title="Analytics" text="Dashboards and reports. (Coming soon)" />}
            />
            <Route
              path="/security"
              element={<SimplePage title="Security" text="Security and permissions. (Coming soon)" />}
            />
            <Route
              path="/api"
              element={<SimplePage title="API" text="API configuration. (Coming soon)" />}
            />
            <Route
              path="/settings"
              element={<SimplePage title="Settings" text="Application settings. (Coming soon)" />}
            />

            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
