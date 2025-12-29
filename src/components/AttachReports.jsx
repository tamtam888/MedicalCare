// src/components/AttachReports.jsx
import { useState } from "react";

function AttachReports({ patientId, existingReports, onAddReport }) {
  const [uploadError, setUploadError] = useState("");
  const reports = Array.isArray(existingReports) ? existingReports : [];

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
    };

    if (typeof onAddReport === "function") {
      onAddReport(patientId, reportMeta);
    }

    event.target.value = "";
  };

  const handleDownload = () => {
    alert("Download is not implemented yet in this MVP.");
  };

  const handleDelete = () => {
    alert("Delete is not implemented yet in this MVP.");
  };

  return (
    <div className="reports-container">
      <div className="reports-header-row">
        <h3 className="reports-title">Reports</h3>
      </div>

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

      {reports.length === 0 ? (
        <p className="empty-state">No reports uploaded yet</p>
      ) : (
        <ul className="report-list">
          {reports.map((report) => (
            <li key={report.id} className="report-item">
              <div className="report-main">
                <span className="report-icon">📄</span>
                <div className="report-info">
                  <div className="report-name">{report.name}</div>
                  <div className="report-meta">
                    <span>
                      {Math.round(report.size / 1024)} KB ·{" "}
                      {report.uploadedAt
                        ? new Date(report.uploadedAt).toLocaleDateString()
                        : ""}
                    </span>
                  </div>
                </div>
              </div>

              <div className="report-actions">
                <button
                  type="button"
                  className="secondary-button"
                  onClick={handleDownload}
                >
                  Download
                </button>
                <button
                  type="button"
                  className="danger-button"
                  onClick={handleDelete}
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
