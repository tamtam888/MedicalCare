// src/pages/DashboardPage.jsx
import React from "react";
import DashboardContent from "../components/DashboardContent";
import { usePatients } from "../hooks/usePatients";
import { isIndexedDBAvailable } from "../utils/indexedDBStorage";
import "./DashboardPage.css";

function DashboardPage({ language = "en" }) {
  const isHebrew = language === "he";
  const { patients, handleSyncAllToMedplum, storageInfo } = usePatients();

  return (
    <div
      className={
        "dashboard-page " +
        (isHebrew ? "dashboard-page-rtl" : "dashboard-page-ltr")
      }
    >
      <div className="dashboard-page-inner">
        <div className="dashboard-header-block">
          <h1 className="dashboard-welcome-title">
            {isHebrew ? "Welcome Back" : "Welcome Back"}
          </h1>

          <h3 className="dashboard-subtitle">
            {isHebrew ? "Medical Care" : "Medical Care"}
          </h3>

          <button
            className="primary-button dashboard-sync-button"
            onClick={handleSyncAllToMedplum}
          >
            {isHebrew ? "Sync with Medical" : "Sync with Medical"}
          </button>
        </div>

        {/* Storage Information */}
        {storageInfo && storageInfo.available && (
          <div className="storage-info-card">
            <div className="storage-info-header">
              <span className="storage-info-icon">💾</span>
              <h3 className="storage-info-title">
                {isHebrew ? "שטח אחסון" : "Storage"}
              </h3>
            </div>
            <div className="storage-info-content">
              <p className="storage-info-text">
                {isHebrew
                  ? `נפח משוער: ${storageInfo.estimate} MB`
                  : `Estimated size: ${storageInfo.estimate} MB`}
              </p>
              <p className="storage-info-text">
                {isHebrew
                  ? `מספר מטופלים: ${storageInfo.patientCount || patients.length}`
                  : `Patients: ${storageInfo.patientCount || patients.length}`}
              </p>
              {storageInfo.estimate > 50 && (
                <p className="storage-info-warning">
                  {isHebrew
                    ? "⚠️ שטח אחסון גדול. מומלץ לסנכרן למדפלום."
                    : "⚠️ Large storage usage. Consider syncing to Medplum."}
                </p>
              )}
              {!isIndexedDBAvailable() && (
                <p className="storage-info-warning">
                  {isHebrew
                    ? "⚠️ IndexedDB לא זמין. משתמש ב-localStorage (מוגבל ל-5-10MB)."
                    : "⚠️ IndexedDB not available. Using localStorage (limited to 5-10MB)."}
                </p>
              )}
            </div>
          </div>
        )}

        <DashboardContent language={language} patients={patients} />
      </div>
    </div>
  );
}

export default DashboardPage;
