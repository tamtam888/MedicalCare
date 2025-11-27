// src/components/DashboardContent.jsx
import "./DashboardContent.css";

const TEXTS = {
  en: {
    titleBar: "MedicalCare Dashboard",
    welcomeTitle: "Welcome Back",
    welcomeSubtitle: "Overview of your clinical activity",
    totalPatients: "Total patients",
    activePlans: "Active plans",
    upcomingAppointments: "Upcoming appointments",
    reports: "Reports",
    upcomingAppointmentsTitle: "Upcoming appointments",
    recentTreatmentsTitle: "Recent treatments",
    noData: "No data available"
  },
  he: {
    titleBar: "MedicalCare Dashboard",
    welcomeTitle: "ברוכים השבים",
    welcomeSubtitle: "סקירת פעילות המרפאה שלך",
    totalPatients: "סה\"כ מטופלים",
    activePlans: "תוכניות פעילות",
    upcomingAppointments: "פגישות קרובות",
    reports: "דוחות",
    upcomingAppointmentsTitle: "פגישות קרובות",
    recentTreatmentsTitle: "טיפולים אחרונים",
    noData: "אין נתונים זמינים"
  }
};

function DashboardContent({ language = "en", patients = [] }) {
  const isHebrew = language === "he";
  const t = TEXTS[language] || TEXTS.en;
  const totalPatients = Array.isArray(patients) ? patients.length : 0;

  return (
    <div
      className={
        "dashboard-content-root " +
        (isHebrew ? "dashboard-content-rtl" : "dashboard-content-ltr")
      }
    >
      <header className="dashboard-topbar">
        <div className="dashboard-topbar-left">
          <h1 className="dashboard-topbar-title">{t.titleBar}</h1>
        </div>
      </header>

      <section className="dashboard-welcome">
        <h2 className="dashboard-welcome-title">{t.welcomeTitle}</h2>
        <p className="dashboard-welcome-subtitle">{t.welcomeSubtitle}</p>
      </section>

      <section className="dashboard-stats-row">
        <div className="stat-card">
          <div className="stat-card-label">{t.totalPatients}</div>
          <div className="stat-card-value">{totalPatients}</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">{t.activePlans}</div>
          <div className="stat-card-value">0</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">{t.upcomingAppointments}</div>
          <div className="stat-card-value">0</div>
        </div>

        <div className="stat-card">
          <div className="stat-card-label">{t.reports}</div>
          <div className="stat-card-value">0</div>
        </div>
      </section>

      <section className="dashboard-bottom-row">
        <div className="bottom-card">
          <h3 className="bottom-card-title">
            {t.upcomingAppointmentsTitle}
          </h3>
          <div className="bottom-card-body bottom-card-empty">
            <span className="bottom-card-empty-text">{t.noData}</span>
          </div>
        </div>

        <div className="bottom-card">
          <h3 className="bottom-card-title">
            {t.recentTreatmentsTitle}
          </h3>
          <div className="bottom-card-body bottom-card-empty">
            <span className="bottom-card-empty-text">{t.noData}</span>
          </div>
        </div>
      </section>
    </div>
  );
}

export default DashboardContent;
