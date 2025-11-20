// src/components/AttachReports.jsx
import React, { useState } from "react";

function AttachReports({ patientId, existingReports, onAddReport }) {
  const [uploadError, setUploadError] = useState("");

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
      return;
    }

    setUploadError("");

    const reportMeta = {
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      // In a real backend you will save the file on the server.
      // For this MVP we keep only metadata.
    };

    console.log("Report uploaded for patient:", patientId, reportMeta);

    onAddReport(patientId, reportMeta);

    // reset input so same file can be reselected if needed
    event.target.value = "";
  };

  const handleDownload = (report) => {
    // For real backend: fetch the file from API and download
    alert("Download is not implemented yet in the front end only MVP.");
  };

  const handleDelete = (reportId) => {
    alert(
      "Delete is not implemented yet in this MVP. You can add it later with backend support."
    );
  };

  return (
    <div className="reports-container">
      <label className="file-upload-label">
        <span className="file-upload-button">Upload PDF report</span>
        <input
          type="file"
          accept="application/pdf"
          onChange={handleFileChange}
          className="file-upload-input"
        />
      </label>

      {uploadError && <p className="error-text">{uploadError}</p>}

      {existingReports.length === 0 ? (
        <p className="empty-state">No reports uploaded yet</p>
      ) : (
        <ul className="report-list">
          {existingReports.map((report) => (
            <li key={report.id} className="report-item">
              <div className="report-main">
                <span className="report-icon">📄</span>
                <div className="report-info">
                  <div className="report-name">{report.name}</div>
                  <div className="report-meta">
                    <span>
                      {Math.round(report.size / 1024)} KB ·{" "}
                      {new Date(report.uploadedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </div>

              <div className="report-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => handleDownload(report)}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => handleDelete(report.id)}
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default AttachReports;
