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
import { Globe2 } from "lucide-react";
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
    <div className={"app-shell" + (isHebrew ? " app-shell-rtl" : "")}>
      <Sidebar language={language} />

      <div className="app-main-area" dir={isHebrew ? "rtl" : "ltr"}>
        <header className="app-header">
          <div className="app-header-right">
            <button
              type="button"
              className="primary-button medplum-header-button"
              onClick={handleConnectMedplum}
            >
              {medplumProfile
                ? "Medplum: Connected"
                : "Connect to Medplum"}
            </button>

            <button
              type="button"
              className="lang-switch"
              dir="ltr"
              onClick={handleToggleLanguage}
              title="Change language"
            >
              <span className="lang-switch-part">ILS</span>
              <span className="lang-switch-separator">|</span>
              <span className="lang-switch-part">
                {isHebrew ? "HE" : "EN"}
              </span>
              <span className="lang-switch-separator">|</span>
              <span className="lang-switch-part">IL</span>
              <Globe2 size={16} className="lang-switch-icon" />
            </button>
          </div>
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
                <DashboardPage patients={patients} language={language} />
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
                  handleDeleteReport={patientsState.handleDeleteReport}
                  handleSaveTranscription={
                    patientsState.handleSaveTranscription
                  }
                  handleEditPatient={patientsState.handleEditPatient}
                  onUpdatePatient={
                    patientsState.handleUpdatePatientInline
                  }
                  handleExportPatients={
                    patientsState.handleExportPatients
                  }
                  handleImportPatients={
                    patientsState.handleImportPatients
                  }
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
