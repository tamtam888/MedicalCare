// src/components/AttachReports.jsx
import { useState } from "react";
import "./AttachReports.css";

function AttachReports({ patientId, existingReports, onAddReport, onDeleteReport }) {
  const [uploadError, setUploadError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      setUploadError("Only PDF files are allowed.");
      event.target.value = "";
      return;
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB in bytes
    if (file.size > maxSize) {
      setUploadError("File size must be less than 10MB.");
      event.target.value = "";
      return;
    }

    setUploadError("");
    setIsUploading(true);

    try {
      // Read file as base64 data URL
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64Data = reader.result; // data:application/pdf;base64,...
        
        const reportMeta = {
          id: crypto.randomUUID(),
          name: file.name,
          size: file.size,
          uploadedAt: new Date().toISOString(),
          fileData: base64Data, // Store the actual PDF content as base64
        };

        try {
          onAddReport(patientId, reportMeta);
          event.target.value = "";
          setIsUploading(false);
        } catch (error) {
          console.error("Failed to add report:", error);
          setUploadError("Failed to upload report. Please try again.");
          setIsUploading(false);
          event.target.value = "";
        }
      };
      
      reader.onerror = () => {
        setUploadError("Failed to read file. Please try again.");
        setIsUploading(false);
        event.target.value = "";
      };
      
      reader.readAsDataURL(file);
    } catch (error) {
      console.error("Failed to process file:", error);
      setUploadError("Failed to process file. Please try again.");
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const handleDownload = (report) => {
    if (!report.fileData) {
      alert("File data is not available for this report.");
      return;
    }

    try {
      // Extract base64 data (remove data URL prefix)
      const base64Data = report.fileData.split(",")[1] || report.fileData;
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      
      const blob = new Blob([bytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = report.name || "report.pdf";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download report:", error);
      alert("Failed to download report. Please try again.");
    }
  };

  const handleDelete = (reportId) => {
    if (
      window.confirm(
        "Are you sure you want to delete this report? This action cannot be undone."
      )
    ) {
      if (typeof onDeleteReport === "function") {
        onDeleteReport(patientId, reportId);
      } else {
        alert("Delete functionality is not available.");
      }
    }
  };

  return (
    <div className="reports-container">
      <div className="reports-upload-row">
        <label className="file-upload-label">
          <span className="file-upload-button" style={{ opacity: isUploading ? 0.6 : 1 }}>
            <span className="file-upload-icon">📎</span>
            <span className="file-upload-text">
              {isUploading ? "Uploading..." : "Upload PDF report"}
            </span>
          </span>
          <input
            type="file"
            accept="application/pdf"
            onChange={handleFileChange}
            className="file-upload-input"
            disabled={isUploading}
          />
        </label>

        {uploadError && <p className="error-text">{uploadError}</p>}
      </div>

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
                  disabled={!report.fileData}
                  title={report.fileData ? "Download PDF" : "File data not available"}
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

/*
 * FILE DOCUMENTATION: src/components/AttachReports.jsx
 * 
 * Component for uploading, managing, and downloading PDF reports for patients.
 * 
 * FEATURES:
 * - PDF file upload with validation (type and size checks)
 * - Stores complete PDF file content as base64 data URL
 * - Download functionality to retrieve saved PDFs
 * - Delete functionality to remove reports
 * - Visual feedback during upload process
 * 
 * PROPS:
 * - patientId: The ID number of the patient
 * - existingReports: Array of report objects with metadata and file data
 * - onAddReport: Callback function when a report is uploaded
 * - onDeleteReport: Callback function when a report is deleted
 * 
 * REPORT STRUCTURE:
 * Each report object contains:
 * - id: Unique identifier (UUID)
 * - name: Original filename
 * - size: File size in bytes
 * - uploadedAt: ISO timestamp
 * - fileData: Base64 encoded PDF content (data URL format)
 * 
 * VALIDATION:
 * - Only PDF files are accepted (application/pdf)
 * - Maximum file size: 10MB
 * - Error messages displayed for invalid files
 * 
 * STORAGE:
 * Reports are stored in the patient's reports array in localStorage.
 * The complete PDF content is stored as base64, allowing full offline functionality.
 */
