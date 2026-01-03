import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { usePatients } from "./hooks/usePatients";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailsPage from "./pages/PatientDetailsPage";
import CarePlansPage from "./pages/CarePlansPage";
import { medplum } from "./medplumClient";
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
  const { patients } = patientsState;

  const [medplumProfile, setMedplumProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    async function initAuth() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          await medplum.processCode(code);
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);
        }

        const isAuthenticated = medplum.isAuthenticated();
        if (isAuthenticated) {
          try {
            const profile = medplum.getProfile();
            setMedplumProfile(profile || null);
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn("Failed to get Medplum profile:", error);
            }
            setMedplumProfile(null);
          }
        } else {
          setMedplumProfile(null);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Medplum authentication failed:", error);
        }
        setMedplumProfile(null);
      } finally {
        setAuthReady(true);
      }
    }

    initAuth();
  }, []);

  const handleConnectMedplum = async () => {
    try {
      if (medplum.isAuthenticated()) {
        const confirmDisconnect = window.confirm(
          "Are you sure you want to disconnect from Medplum?"
        );
        if (confirmDisconnect) {
          await medplum.signOut();
          setMedplumProfile(null);
        }
      } else {
        medplum.signInWithRedirect();
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.error("Failed to connect/disconnect Medplum:", error);
      }
      alert("Failed to connect to Medplum. Please try again.");
    }
  };

  if (!authReady) {
    return <div className="app-loading">Loading MedicalCare...</div>;
  }

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main-area">
        <header className="app-header">
          <div className="app-header-right">
            <button
              type="button"
              className="header-icon-button"
              title="Settings"
            >
              ⚙️
            </button>
            <button
              type="button"
              className="primary-button medplum-header-button"
              onClick={handleConnectMedplum}
            >
              {medplumProfile ? "Medplum: Connected" : "Connect to Medplum"}
            </button>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            {/* default redirect */}
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route
              path="/dashboard"
              element={<DashboardPage patients={patients} />}
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
                  selectedPatientFullName={
                    patientsState.selectedPatientFullName
                  }
                  handleSelectPatient={patientsState.handleSelectPatient}
                  handleAddReport={patientsState.handleAddReport}
                  handleDeleteReport={patientsState.handleDeleteReport}
                  handleSaveTranscription={
                    patientsState.handleSaveTranscription
                  }
                  handleEditPatient={patientsState.handleEditPatient}
                  onUpdatePatient={patientsState.handleUpdatePatientInline}
                  handleExportPatients={patientsState.handleExportPatients}
                  handleImportPatients={patientsState.handleImportPatients}
                />
              }
            />

            <Route
              path="/data/treatment"
              element={
                <SimplePage
                  title="Treatment data"
                  text="Analyze treatment records. (Coming soon)"
                />
              }
            />

            <Route
              path="/data/care-plan"
              element={
                <CarePlansPage
                  patients={patientsState.patients}
                  onUpdatePatient={patientsState.handleUpdatePatientInline}
                />
              }
            />

            <Route
              path="/data/appointment"
              element={
                <SimplePage
                  title="Appointments data"
                  text="Appointment data view. (Coming soon)"
                />
              }
            />

            <Route
              path="/analytics"
              element={
                <SimplePage
                  title="Analytics"
                  text="Dashboards and reports. (Coming soon)"
                />
              }
            />

            <Route
              path="/security"
              element={
                <SimplePage
                  title="Security"
                  text="Security and permissions. (Coming soon)"
                />
              }
            />

            <Route
              path="/api"
              element={
                <SimplePage
                  title="API"
                  text="API configuration. (Coming soon)"
                />
              }
            />

            <Route
              path="/settings"
              element={
                <SimplePage
                  title="Settings"
                  text="Application settings. (Coming soon)"
                />
              }
            />

            {/* catch-all: any unknown path -> patients list */}
            <Route path="*" element={<Navigate to="/patients" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
