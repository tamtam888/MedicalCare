// src/pages/DashboardPage.jsx
import DashboardContent from "../components/DashboardContent";
import "./DashboardPage.css";

function DashboardPage({ language = "en", patients = [] }) {
  const isHebrew = language === "he";

  return (
    <div
      className={
        "dashboard-page " +
        (isHebrew ? "dashboard-page-rtl" : "dashboard-page-ltr")
      }
    >
      <div className="dashboard-wrapper">
        <DashboardContent language={language} patients={patients} />
      </div>
    </div>
  );
}

export default DashboardPage;
