import React, { useMemo, useState } from "react";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { formatDateDMY, formatDateTimeDMY, parseFlexibleDate } from "../utils/dateFormat";
import "./AttachReports.css";

function AttachReports({
  patient,
  patientId,
  existingReports,
  onAddReport,
  onDeleteReport,
  selectedEntries,
  onClearSelected,
  onSaveReportEntry,
  totalHistoryCount,
}) {
  const [uploadError, setUploadError] = useState("");
  const [aiError, setAiError] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const [patientHeader, setPatientHeader] = useState("");
  const [reportText, setReportText] = useState("");
  const [kpi, setKpi] = useState(null);

  const reports = Array.isArray(existingReports) ? existingReports : [];
  const selected = Array.isArray(selectedEntries) ? selectedEntries : [];
  const selectedCount = selected.length;

  const safePatientName = useMemo(() => {
    const first = String(patient?.firstName || "").trim();
    const last = String(patient?.lastName || "").trim();
    const full = `${first} ${last}`.trim();
    return full || "Unknown patient";
  }, [patient?.firstName, patient?.lastName]);

  const canUseReport = Boolean(String(reportText || "").trim());

  const clearAll = () => {
    setPatientHeader("");
    setReportText("");
    setKpi(null);
    setAiError("");
    setUploadError("");
  };

  const clearReportOnly = () => {
    setReportText("");
    setKpi(null);
    setAiError("");
  };

  const formatDobDMY = (raw) => {
    const d = parseFlexibleDate(raw);
    if (!d) return "";
    return formatDateDMY(d);
  };

  const fillPatientDetailsLocal = () => {
    const lines = [];
    const id = String(patientId || "").trim();

    const dobRaw = patient?.dob ?? patient?.dateOfBirth ?? patient?.birthDate ?? patient?.birthDateTime ?? "";
    const dob = formatDobDMY(dobRaw);

    const phone = String(patient?.phone || "").trim();
    const email = String(patient?.email || "").trim();
    const address = String(patient?.address || "").trim();

    lines.push(`Patient Name: ${safePatientName || "______________________________"}`);
    lines.push(`Patient ID: ${id || "_______________________________"}`);
    lines.push(`DOB: ${dob || "_____________________________________"}`);
    if (phone) lines.push(`Phone: ${phone}`);
    if (email) lines.push(`Email: ${email}`);
    if (address) lines.push(`Address: ${address}`);
    lines.push("Therapist: ______________________________");
    lines.push("Reporting Period: ________________________");

    setPatientHeader(lines.join("\n"));
  };

  const toDeidentifiedVisit = (entry, index) => {
    const type = String(entry?.type || "other").toLowerCase();
    const dateIso = entry?.date ? new Date(entry.date).toISOString() : "";
    const date = dateIso ? dateIso.slice(0, 10) : "";
    const title = String(entry?.title || "").slice(0, 160);

    const raw = String(entry?.summary || "");
    const scrubbed = raw
      .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, "[REDACTED]")
      .replace(/\b\d{7,}\b/g, "[REDACTED]")
      .slice(0, 2200);

    return {
      visitNo: index + 1,
      type,
      date,
      title,
      summary: scrubbed,
      hasAudio: Boolean(entry?.audioId || entry?.audioUrl || entry?.audioData),
    };
  };

  const extractCarePlanContext = (p) => {
    const cp = p?.carePlan ?? p?.careplan ?? p?.plan ?? p?.carePlanDraft ?? null;

    const goalsRaw = cp?.goals ?? cp?.therapyGoals ?? p?.therapyGoals ?? p?.goals ?? [];
    const exercisesRaw = cp?.exercises ?? cp?.items ?? p?.exercises ?? [];

    const goals = Array.isArray(goalsRaw)
      ? goalsRaw
          .map((g) => {
            if (!g) return null;
            const title = String(g?.title || g?.name || g?.goal || "").trim();
            const status = String(g?.status || g?.state || "").trim();
            const target = String(g?.target || g?.targetDate || "").trim();
            const notes = String(g?.notes || g?.description || "").trim();
            const cleaned = [title, status, target, notes].join(" ").trim();
            return cleaned ? { title, status, target, notes } : null;
          })
          .filter(Boolean)
          .slice(0, 30)
      : [];

    const exercises = Array.isArray(exercisesRaw)
      ? exercisesRaw
          .map((ex) => {
            if (!ex) return null;
            const name = String(ex?.name || ex?.title || ex?.exercise || "").trim();
            const instructions = String(ex?.instructions || ex?.description || "").trim();
            const dosage = String(ex?.dosage || ex?.frequency || ex?.reps || "").trim();
            const cleaned = [name, instructions, dosage].join(" ").trim();
            return cleaned ? { name, instructions, dosage } : null;
          })
          .filter(Boolean)
          .slice(0, 60)
      : [];

    const hasAny = goals.length > 0 || exercises.length > 0;
    return hasAny ? { goals, exercises } : null;
  };

  const handleGenerateAiReport = async () => {
    if (selectedCount === 0) return;

    setIsGenerating(true);
    setAiError("");

    try {
      const visits = selected.map((e, i) => toDeidentifiedVisit(e, i));
      const carePlan = extractCarePlanContext(patient);

      const res = await fetch("/api/ai/treatment-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          visits,
          carePlan,
          totalHistoryCount: Number(totalHistoryCount || 0),
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || "AI request failed");
      }

      const data = await res.json().catch(() => ({}));
      const nextReportText = String(data?.reportText || data?.text || data?.markdown || "").trim();
      const nextKpi = data?.kpi && typeof data.kpi === "object" ? data.kpi : null;

      if (!nextReportText) throw new Error("Empty AI response");

      setReportText(nextReportText);
      setKpi(nextKpi);
    } catch {
      setAiError("Failed to generate AI report. Check server logs and API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const wrapText = (text, font, fontSize, maxWidth) => {
    const paragraphs = String(text || "").split("\n");
    const lines = [];

    for (const p of paragraphs) {
      const trimmed = String(p || "").trimEnd();
      if (!trimmed.trim()) {
        lines.push("");
        continue;
      }

      const words = trimmed.split(/\s+/).filter(Boolean);
      let line = "";

      for (const w of words) {
        const test = line ? `${line} ${w}` : w;
        const wWidth = font.widthOfTextAtSize(test, fontSize);
        if (wWidth <= maxWidth) {
          line = test;
        } else {
          if (line) lines.push(line);
          line = w;
        }
      }

      if (line) lines.push(line);
    }

    return lines;
  };

  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const kpiLines = (k) => {
    if (!k) return [];
    const lines = [];

    const rp = String(k.reportingPeriod || "").trim();
    if (rp) lines.push(`Reporting Period: ${rp}`);

    const ss = Number.isFinite(Number(k.sessionsSelected)) ? Number(k.sessionsSelected) : null;
    const st = Number.isFinite(Number(k.sessionsTotal)) ? Number(k.sessionsTotal) : null;
    if (ss !== null && st !== null) lines.push(`Sessions: ${ss} / ${st}`);
    else if (ss !== null) lines.push(`Sessions Selected: ${ss}`);

    const g = k.goals && typeof k.goals === "object" ? k.goals : null;
    if (g) {
      const total = Number.isFinite(Number(g.total)) ? Number(g.total) : null;
      const achieved = Number.isFinite(Number(g.achieved)) ? Number(g.achieved) : null;
      const inProgress = Number.isFinite(Number(g.inProgress)) ? Number(g.inProgress) : null;
      const notAchieved = Number.isFinite(Number(g.notAchieved)) ? Number(g.notAchieved) : null;

      if (total !== null) lines.push(`Goals: ${total}`);
      if (achieved !== null || inProgress !== null || notAchieved !== null) {
        const parts = [];
        if (achieved !== null) parts.push(`Achieved: ${achieved}`);
        if (inProgress !== null) parts.push(`In progress: ${inProgress}`);
        if (notAchieved !== null) parts.push(`Not achieved: ${notAchieved}`);
        if (parts.length) lines.push(parts.join(" | "));
      }
    }

    const fps = Number.isFinite(Number(k.functionalProgressScore)) ? Number(k.functionalProgressScore) : null;
    if (fps !== null) lines.push(`Functional progress: ${fps} / 10`);

    const trend = String(k.overallTrend || "").trim();
    if (trend) lines.push(`Overall trend: ${trend}`);

    return lines;
  };

  const handleDownloadPdf = async () => {
    const content = String(reportText || "").trim();
    if (!content) return;

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    let page = pdfDoc.addPage();
    let { width, height } = page.getSize();

    const marginX = 52;
    const topY = height - 60;
    const bottomY = 72;
    const maxWidth = width - marginX * 2;

    const drawLine = (text, y, size) => {
      page.drawText(String(text || ""), { x: marginX, y, size, font, maxWidth });
      return y - (size + 6);
    };

    const ensureSpace = (y) => {
      if (y < bottomY) {
        page = pdfDoc.addPage();
        ({ width, height } = page.getSize());
        return height - 60;
      }
      return y;
    };

    let y = topY;

    y = drawLine("Treatment Report", y, 18);
    y = drawLine(`Generated: ${formatDateTimeDMY(new Date())}`, y, 10);
    y -= 8;

    const headerBlock = String(patientHeader || "").trim();
    const headerEffective = headerBlock
      ? headerBlock
      : [
          "Patient Name: ______________________________",
          "Patient ID: _________________________________",
          "DOB: _______________________________________",
          "Therapist: __________________________________",
          "Reporting Period: ___________________________",
        ].join("\n");

    y = ensureSpace(y);
    y = drawLine("Patient details (local / paste):", y, 11);

    for (const line of wrapText(headerEffective, font, 10, maxWidth)) {
      y = ensureSpace(y);
      if (line === "") y -= 16;
      else y = drawLine(line, y, 10);
    }

    y -= 10;

    const lines = kpiLines(kpi);
    if (lines.length) {
      y = ensureSpace(y);
      y = drawLine("Dashboard", y, 11);
      y -= 2;

      for (const line of lines) {
        y = ensureSpace(y);
        y = drawLine(line, y, 10);
      }

      y -= 10;
    }

    y = ensureSpace(y);
    y = drawLine("Clinical report", y, 11);
    y -= 2;

    for (const line of wrapText(content, font, 10, maxWidth)) {
      y = ensureSpace(y);
      if (line === "") y -= 16;
      else y = drawLine(line, y, 10);
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes], { type: "application/pdf" });
    downloadBlob(blob, "treatment-report.pdf");
  };

  const handleSendEmail = () => {
    const subject = encodeURIComponent("Treatment Report");
    const bodyParts = [];

    bodyParts.push("PATIENT DETAILS (local / paste):");
    const headerText = String(patientHeader || "").trim();
    if (headerText) bodyParts.push(headerText);
    else {
      bodyParts.push("Patient Name: ______________________________");
      bodyParts.push("Patient ID: _________________________________");
      bodyParts.push("DOB: _______________________________________");
      bodyParts.push("Therapist: __________________________________");
      bodyParts.push("Reporting Period: ___________________________");
    }

    const lines = kpiLines(kpi);
    if (lines.length) {
      bodyParts.push("");
      bodyParts.push("DASHBOARD:");
      bodyParts.push(...lines);
    }

    bodyParts.push("");
    bodyParts.push("CLINICAL REPORT:");
    bodyParts.push("");
    const content = String(reportText || "").trim();
    if (content) bodyParts.push(content);

    const body = encodeURIComponent(bodyParts.join("\n"));
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleSaveToPatient = () => {
    const content = String(reportText || "").trim();
    if (!content) return;

    const entry = {
      id: crypto?.randomUUID?.() ?? `r_${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: "report",
      date: new Date().toISOString(),
      title: "Treatment report",
      summary: content,
      kpi: kpi && typeof kpi === "object" ? kpi : null,
      audioUrl: "",
      audioData: null,
      audioId: "",
    };

    if (typeof onSaveReportEntry === "function") {
      onSaveReportEntry(entry);
    }

    if (typeof onClearSelected === "function") {
      onClearSelected();
    }

    clearAll();
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

  const handleDownload = () => {
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
    <div className="reports-surface">
      <div className="reports-top">
        <div className="reports-top-left">
          <div className="reports-kicker">Insert / paste patient details (local only)</div>
          <div className="reports-actions-row">
            <button type="button" className="reports-pill" onClick={fillPatientDetailsLocal}>
              Fill Patient Details
            </button>

            <label className="reports-pill reports-upload">
              <span>Upload PDF</span>
              <input type="file" accept="application/pdf" onChange={handleFileChange} />
            </label>
          </div>
        </div>
      </div>

      <textarea
        className="reports-textarea reports-textarea-patient"
        value={patientHeader}
        onChange={(e) => setPatientHeader(e.target.value)}
        placeholder={`Example:\nPatient Name: ${safePatientName}\nPatient ID: ${String(patientId || "")}\nDOB: ${formatDateDMY(new Date())}\nTherapist: ...\nReporting Period: ...`}
      />

      <div className="reports-divider" />

      <div className="reports-kicker">Generate AI report (no patient identifiers are sent)</div>

      <button
        type="button"
        className="reports-pill"
        onClick={handleGenerateAiReport}
        disabled={selectedCount === 0 || isGenerating}
        title={selectedCount === 0 ? "Select visits from history first" : "Generate report from selected visits"}
      >
        {isGenerating ? "Generating..." : `Generate AI Report (${selectedCount})`}
      </button>

      <textarea
        className="reports-textarea reports-textarea-report"
        value={reportText}
        onChange={(e) => setReportText(e.target.value)}
        placeholder="Write your report here, or generate it from selected visits..."
      />

      <div className="reports-actions-bottom">
        <button type="button" className="reports-pill" onClick={handleSaveToPatient} disabled={!canUseReport}>
          Save to Patient
        </button>
        <button type="button" className="reports-pill" onClick={handleDownloadPdf} disabled={!canUseReport}>
          Download PDF
        </button>
        <button type="button" className="reports-pill" onClick={handleSendEmail} disabled={!canUseReport}>
          Send Email
        </button>
        <button
          type="button"
          className="reports-pill reports-pill-muted"
          onClick={clearReportOnly}
          disabled={!canUseReport}
        >
          Clear
        </button>
      </div>

      {(uploadError || aiError) && (
        <div className="reports-errors">
          {uploadError ? <div className="reports-error">{uploadError}</div> : null}
          {aiError ? <div className="reports-error">{aiError}</div> : null}
        </div>
      )}

      <div className="reports-uploaded">
        <div className="reports-kicker">Uploaded reports</div>

        {reports.length === 0 ? (
          <div className="reports-empty">No reports uploaded yet</div>
        ) : (
          <ul className="reports-list">
            {reports.map((report) => (
              <li key={report.id} className="reports-item">
                <div className="reports-item-left">
                  <span className="reports-icon">📄</span>
                  <div className="reports-item-info">
                    <div className="reports-item-name">{report.name}</div>
                    <div className="reports-item-meta">
                      {Math.round(report.size / 1024)} KB ·{" "}
                      {report.uploadedAt ? new Date(report.uploadedAt).toLocaleDateString() : ""}
                    </div>
                  </div>
                </div>

                <div className="reports-item-actions">
                  <button type="button" className="reports-small" onClick={() => handleDownload(report)}>
                    Download
                  </button>
                  <button
                    type="button"
                    className="reports-small reports-small-danger"
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
    </div>
  );
}

export default AttachReports;
