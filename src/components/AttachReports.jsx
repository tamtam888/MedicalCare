import React, { useMemo, useState } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { formatDateDMY, formatDateTimeDMY } from "../utils/dateFormat";

function AttachReports({
  patient,
  patientId,
  existingReports,
  onAddReport,
  onDeleteReport,
  selectedEntries,
  onClearSelected,
}) {
  const [uploadError, setUploadError] = useState("");
  const reports = Array.isArray(existingReports) ? existingReports : [];
  const selected = Array.isArray(selectedEntries) ? selectedEntries : [];
  const selectedCount = selected.length;

  const safePatientName = useMemo(() => {
    const first = String(patient?.firstName || "").trim();
    const last = String(patient?.lastName || "").trim();
    const full = `${first} ${last}`.trim();
    return full || "Unknown patient";
  }, [patient?.firstName, patient?.lastName]);

  const handleGeneratePdf = async () => {
    if (selectedCount === 0) return;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();

    const drawLine = (text, y, size = 12) => {
      page.drawText(String(text || ""), { x: 50, y, size, font, maxWidth: width - 100 });
      return y - (size + 6);
    };

    let y = height - 60;

    y = drawLine("Treatment Summary Report", y, 18);
    y = drawLine(`Generated: ${formatDateTimeDMY(new Date())}`, y, 10);
    y -= 6;

    y = drawLine(`Patient: ${safePatientName}`, y, 12);
    y = drawLine(`Patient ID: ${String(patientId || "-")}`, y, 12);
    y -= 12;

    for (const entry of selected) {
      const title = entry?.title || "(No title)";
      const date = entry?.date ? formatDateDMY(entry.date) : "";
      const type = String(entry?.type || "").toUpperCase();
      const summary = String(entry?.summary || "").trim();

      y = drawLine(`${type}${date ? ` • ${date}` : ""}`, y, 10);
      y = drawLine(title, y, 12);

      if (summary) {
        const clipped = summary.length > 900 ? `${summary.slice(0, 900)}…` : summary;
        y = drawLine(clipped, y, 10);
      } else {
        y = drawLine("(No summary text)", y, 10);
      }

      y -= 10;

      if (y < 80) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        y = height - 60;
      }
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "treatment-summary.pdf";
    document.body.appendChild(a);
    a.click();
    a.remove();

    URL.revokeObjectURL(url);

    if (typeof onClearSelected === "function") {
      onClearSelected();
    }
  };

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

  const handleDownload = (report) => {
    alert("Download is not implemented yet in this MVP.");
  };

  const handleDelete = (reportId) => {
    if (typeof onDeleteReport === "function") {
      onDeleteReport(patientId, reportId);
      return;
    }
    alert("Delete is not implemented yet in this MVP.");
  };

  return (
    <div className="reports-container">
      <div className="reports-header-row">
        <h3 className="reports-title">Reports</h3>

        <button
          type="button"
          className="secondary-button"
          onClick={handleGeneratePdf}
          disabled={selectedCount === 0}
          title={
            selectedCount === 0
              ? "Select visits from the history list first"
              : "Generate PDF from selected visits"
          }
        >
          Generate PDF ({selectedCount})
        </button>
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
