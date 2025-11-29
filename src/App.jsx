// src/App.jsx
import { useState, useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { usePatients } from "./hooks/usePatients";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientDataPage from "./pages/PatientDataPage";
import PatientDetailsPage from "./pages/PatientDetailsPage";
import { translations } from "./i18n/translations";
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

  const [language, setLanguage] = useState("en");
  const [medplumProfile, setMedplumProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);

  const isHebrew = language === "he";
  const t = translations[language];

  const handleToggleLanguage = () => {
    setLanguage((prev) => (prev === "en" ? "he" : "en"));
  };

  useEffect(() => {
    async function initAuth() {
      try {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");

        if (code) {
          await medplum.processCode(code);

          const cleanUrl =
            window.location.origin + window.location.pathname;
          window.history.replaceState({}, "", cleanUrl);
        }

        const profile = medplum.getProfile();
        setMedplumProfile(profile || null);
      } catch (error) {
        console.error("Medplum authentication failed:", error);
        setMedplumProfile(null);
      } finally {
        setAuthReady(true);
      }
    }

    initAuth();
  }, []);

  const handleConnectMedplum = () => {
    try {
      medplum.signInWithRedirect();
    } catch (error) {
      console.error("Failed to redirect to Medplum:", error);
    }
  };

  if (!authReady) {
    return <div className="app-loading">Loading MedicalCare...</div>;
  }

  return (
    <div className={`app-shell ${isHebrew ? "shell-rtl" : "shell-ltr"}`}>
      <Sidebar language={language} />

      <div className="app-main-area" dir={isHebrew ? "rtl" : "ltr"}>
        <header className="app-topbar">
          <button
            type="button"
            className="lang-toggle-button"
            onClick={handleToggleLanguage}
          >
            🌐 {t.langButton}
          </button>

          <button
            type="button"
            className="medplum-connect-button"
            onClick={handleConnectMedplum}
          >
            {medplumProfile ? "Medplum: Connected" : "Connect to Medplum"}
          </button>
        </header>

        <main className="app-main">
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/dashboard" replace />}
            />

            <Route
              path="/dashboard"
              element={
                <DashboardPage
                  patients={patients}
                  language={language}
                />
              }
            />

            <Route
              path="/patients"
              element={
                <PatientsPage
                  {...patientsState}
                  language={language}
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
                  handleSaveTranscription={
                    patientsState.handleSaveTranscription
                  }
                  handleEditPatient={patientsState.handleEditPatient}
                  onUpdatePatient={patientsState.handleUpdatePatientInline}
                  handleImportPatient={undefined}
                />
              }
            />

            <Route
              path="/data/patient"
              element={
                <PatientDataPage
                  {...patientsState}
                  language={language}
                />
              }
            />

            <Route
              path="/users"
              element={
                <SimplePage
                  title={t.pages.usersTitle}
                  text={t.pages.usersText}
                />
              }
            />

            <Route
              path="/data/treatment"
              element={
                <SimplePage
                  title={t.pages.dataTreatmentTitle}
                  text={t.pages.dataTreatmentText}
                />
              }
            />

            <Route
              path="/data/care-plan"
              element={
                <SimplePage
                  title={t.pages.dataCarePlanTitle}
                  text={t.pages.dataCarePlanText}
                />
              }
            />

            <Route
              path="/data/appointment"
              element={
                <SimplePage
                  title={t.pages.dataAppointmentTitle}
                  text={t.pages.dataAppointmentText}
                />
              }
            />

            <Route
              path="/analytics"
              element={
                <SimplePage
                  title={t.pages.analyticsTitle}
                  text={t.pages.analyticsText}
                />
              }
            />

            <Route
              path="/security"
              element={
                <SimplePage
                  title={t.pages.securityTitle}
                  text={t.pages.securityText}
                />
              }
            />

            <Route
              path="/api"
              element={
                <SimplePage
                  title={t.pages.apiTitle}
                  text={t.pages.apiText}
                />
              }
            />

            <Route
              path="/settings"
              element={
                <SimplePage
                  title={t.pages.settingsTitle}
                  text={t.pages.settingsText}
                />
              }
            />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default App;
