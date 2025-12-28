import { useCallback, useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { usePatients } from "./hooks/usePatients";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailsPage from "./pages/PatientDetailsPage";
import { medplum } from "./medplumClient";
import Sidebar from "./components/Sidebar";
import { hasMedplumSession } from "./utils/patientFhir";
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

  const [, setMedplumProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const didAutoSyncRef = useRef(false);

  const computeConnected = useCallback(() => {
    try {
      return Boolean(medplum.isAuthenticated?.() || hasMedplumSession());
    } catch (error) {
      void error;
      return hasMedplumSession();
    }
  }, []);

  const refreshProfile = useCallback(() => {
    try {
      const login = medplum.getActiveLogin?.();
      if (login?.profile) {
        setMedplumProfile(login.profile);
        return;
      }
    } catch (error) {
      void error;
    }

    try {
      const profile = medplum.getProfile?.();
      setMedplumProfile(profile || null);
    } catch (error) {
      void error;
      setMedplumProfile(null);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      try {
        const hasOAuthParams =
          window.location.search.includes("code=") ||
          window.location.search.includes("error=");

        if (hasOAuthParams) {
          if (typeof medplum.processRedirect === "function") {
            await medplum.processRedirect();
          } else if (typeof medplum.processCode === "function") {
            await medplum.processCode(window.location.href);
          }
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);
        }

        if (computeConnected()) {
          refreshProfile();
        } else {
          setMedplumProfile(null);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.error("Medplum authentication init failed:", error);
        }
        setMedplumProfile(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    initAuth();

    return () => {
      cancelled = true;
    };
  }, [computeConnected, refreshProfile]);

  useEffect(() => {
    if (!authReady) return;
    if (didAutoSyncRef.current) return;

    const connected = computeConnected();
    if (!connected) return;

    if (!Array.isArray(patients) || patients.length === 0) return;

    didAutoSyncRef.current = true;

    if (typeof patientsState.handleSyncAllToMedplum === "function") {
      patientsState.handleSyncAllToMedplum();
    }
  }, [authReady, computeConnected, patients, patientsState]);

  const handleConnectMedplum = async () => {
    try {
      const connected = computeConnected();

      if (connected) {
        const confirmDisconnect = window.confirm(
          "Are you sure you want to disconnect from Medplum?"
        );
        if (confirmDisconnect) {
          if (typeof medplum.signOut === "function") {
            await medplum.signOut();
          }
          setMedplumProfile(null);
          didAutoSyncRef.current = false;
        }
      } else {
        if (typeof medplum.signInWithRedirect === "function") {
          medplum.signInWithRedirect();
        } else if (typeof medplum.startLogin === "function") {
          await medplum.startLogin();
        } else {
          alert("Medplum login method is not available in this client version.");
        }
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

  const connectedNow = computeConnected();

  return (
    <div className="app-shell">
      <Sidebar />

      <div className="app-main-area">
        <header className="app-header">
          <div className="app-header-right">
            <button type="button" className="header-icon-button" title="Settings">
              ⚙️
            </button>
            <button
              type="button"
              className="primary-button medplum-header-button"
              onClick={handleConnectMedplum}
            >
              {connectedNow ? "Medplum: Connected" : "Connect to Medplum"}
            </button>
          </div>
        </header>

        <main className="app-main">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />

            <Route path="/dashboard" element={<DashboardPage patients={patients} />} />

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
                <SimplePage title="Care plans" text="Care plan data view. (Coming soon)" />
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
              element={<SimplePage title="Analytics" text="Dashboards and reports. (Coming soon)" />}
            />
            <Route
              path="/security"
              element={
                <SimplePage title="Security" text="Security and permissions. (Coming soon)" />
              }
            />
            <Route
              path="/api"
              element={<SimplePage title="API" text="API configuration. (Coming soon)" />}
            />
            <Route
              path="/settings"
              element={<SimplePage title="Settings" text="Application settings. (Coming soon)" />}
            />

            <Route path="*" element={<Navigate to="/patients" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
