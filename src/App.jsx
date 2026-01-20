import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { usePatients } from "./hooks/usePatients";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientDetailsPage from "./pages/PatientDetailsPage";
import CarePlansPage from "./pages/CarePlansPage";
import CalendarTreatmentsPage from "./pages/CalendarTreatmentsPage";
import LoginPage from "./pages/LoginPage";
import UsersPage from "./pages/UsersPage";
import { medplum } from "./medplumClient";
import Sidebar from "./components/Sidebar";
import "./App.css";

const LOGGED_IN_KEY = "mc_logged_in";

function isLoggedIn() {
  try {
    return localStorage.getItem(LOGGED_IN_KEY) === "1";
  } catch {
    return false;
  }
}

function SimplePage({ title, text }) {
  return (
    <div className="page-placeholder">
      <h1 className="page-placeholder-title">{title}</h1>
      <p className="page-placeholder-text">{text}</p>
    </div>
  );
}

function App() {
  const location = useLocation();
  const loggedIn = isLoggedIn();

  const patientsState = usePatients();
  const { patients } = patientsState;

  const [medplumProfile, setMedplumProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function initAuth() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          await medplum.processCode(code);
          const cleanUrl = window.location.origin + window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);
        }

        if (!medplum.isAuthenticated()) {
          if (!cancelled) setMedplumProfile(null);
          return;
        }

        try {
          const profile = medplum.getProfile();
          if (!cancelled) setMedplumProfile(profile || { ok: true });
        } catch {
          if (!cancelled) setMedplumProfile({ ok: true });
        }
      } catch (error) {
        if (import.meta.env.DEV) console.error("Medplum auth init failed:", error);
        if (!cancelled) setMedplumProfile(null);
      } finally {
        if (!cancelled) setAuthReady(true);
      }
    }

    initAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleConnectMedplum = async () => {
    try {
      if (medplum.isAuthenticated()) {
        const confirmDisconnect = window.confirm("Are you sure you want to disconnect from Medplum?");
        if (confirmDisconnect) {
          await medplum.signOut();
          setMedplumProfile(null);
        }
      } else {
        medplum.signInWithRedirect();
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error("Connect/disconnect failed:", error);
      alert("Failed to connect to Medplum. Please try again.");
    }
  };

  if (!authReady) {
    return <div className="app-loading">Loading MedicalCare...</div>;
  }

  const RequireAuth = ({ element }) => {
    if (!isLoggedIn()) return <Navigate to="/login" replace />;
    return element;
  };

  const RedirectRoot = () => <Navigate to={loggedIn ? "/dashboard" : "/login"} replace />;

  const isLoginRoute = location.pathname === "/login";

  return (
    <div className="app-shell">
      {loggedIn && !isLoginRoute ? <Sidebar /> : null}

      <div className="app-main-area">
        {loggedIn && !isLoginRoute ? (
          <header className="app-header">
            <div className="app-header-right">
              <button type="button" className="header-icon-button" title="Settings">
                ⚙️
              </button>

              <button type="button" className="primary-button medplum-header-button" onClick={handleConnectMedplum}>
                {medplumProfile ? "Medplum: Connected" : "Connect to Medplum"}
              </button>
            </div>
          </header>
        ) : null}

        <main className="app-main">
          <Routes>
            <Route path="/" element={<RedirectRoot />} />

            <Route path="/login" element={loggedIn ? <Navigate to="/dashboard" replace /> : <LoginPage />} />

            <Route path="/dashboard" element={<RequireAuth element={<DashboardPage patients={patients} />} />} />

            <Route path="/users" element={<RequireAuth element={<UsersPage />} />} />

            <Route
              path="/patients"
              element={
                <RequireAuth
                  element={
                    <PatientsPage
                      patients={patientsState.patients}
                      onAddPatient={patientsState.handleAddPatient}
                      onUpdatePatient={patientsState.handleUpdatePatient}
                      onDeletePatient={patientsState.handleDeletePatient}
                      onImportPatients={patientsState.handleImportPatients}
                      onExportPatients={patientsState.handleExportPatients}
                      onSelectPatient={patientsState.handleSelectPatient}
                      handleSyncAllToMedplum={patientsState.handleSyncAllToMedplum}
                    />
                  }
                />
              }
            />

            <Route
              path="/patients/:idNumber"
              element={
                <RequireAuth
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
                      handleSaveReportEntry={patientsState.handleSaveReportEntry}
                      handleSyncPatientToMedplum={patientsState.handleSyncPatientToMedplum}
                      handleSaveCarePlanEntry={patientsState.handleSaveCarePlanEntry}
                    />
                  }
                />
              }
            />

            <Route
              path="/data/treatment"
              element={<RequireAuth element={<SimplePage title="Treatment data" text="Analyze treatment records." />} />}
            />

            <Route
              path="/data/care-plan"
              element={
                <RequireAuth
                  element={
                    <CarePlansPage
                      patients={patientsState.patients}
                      onUpdatePatient={patientsState.handleUpdatePatientInline}
                    />
                  }
                />
              }
            />

            <Route
              path="/data/appointment"
              element={
                <RequireAuth
                  element={<CalendarTreatmentsPage medplumProfile={medplumProfile} patients={patientsState.patients} />}
                />
              }
            />

            <Route
              path="/analytics"
              element={<RequireAuth element={<SimplePage title="Analytics" text="Dashboards and reports." />} />}
            />
            <Route
              path="/security"
              element={<RequireAuth element={<SimplePage title="Security" text="Security and permissions." />} />}
            />
            <Route path="/api" element={<RequireAuth element={<SimplePage title="API" text="API configuration." />} />} />
            <Route
              path="/settings"
              element={<RequireAuth element={<SimplePage title="Settings" text="Application settings." />} />}
            />

            <Route path="*" element={<Navigate to={loggedIn ? "/patients" : "/login"} replace />} />
          </Routes>
        </main>

        {loggedIn && !isLoginRoute ? (
          <footer className="app-footer" aria-label="App footer">
            <span className="app-footer-text">© 2026 MedicalCare. All rights reserved.</span>
            <span className="app-footer-sep">•</span>
            <span className="app-footer-text">by TK</span>
          </footer>
        ) : null}
      </div>
    </div>
  );
}

export default App;
