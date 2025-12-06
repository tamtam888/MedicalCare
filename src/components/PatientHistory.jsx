// src/components/PatientHistory.jsx
import { useMemo, useState } from "react";
import "./PatientHistory.css";

function PatientHistory({ patient }) {
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");

  const allEntries = useMemo(
    () => [...(patient?.history || [])],
    [patient?.history]
  );

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const filteredEntries = useMemo(() => {
    let entries = [...allEntries];

    if (filterType !== "all") {
      entries = entries.filter((entry) => {
        const normalizedType = String(entry.type || "").toLowerCase();
        return normalizedType === filterType;
      });
    }

    const trimmed = searchText.trim().toLowerCase();
    if (trimmed) {
      entries = entries.filter((entry) => {
        const title = (entry.title || "").toLowerCase();
        const summary = (entry.summary || "").toLowerCase();
        const visitNote = (entry.visitNote || "").toLowerCase();
        return (
          title.includes(trimmed) ||
          summary.includes(trimmed) ||
          visitNote.includes(trimmed)
        );
      });
    }

    return entries.sort(
      (a, b) =>
        new Date(b.date || 0).getTime() -
        new Date(a.date || 0).getTime()
    );
  }, [allEntries, filterType, searchText]);

  if (!allEntries.length) {
    return (
      <div className="patient-history-card empty-history">
        <p className="history-empty-text">
          No history has been recorded for this patient yet.
        </p>
      </div>
    );
  }

  const typeLabel = (type) => {
    const normalized = String(type || "").toLowerCase();
    switch (normalized) {
      case "transcription":
        return "Transcription";
      case "treatment":
        return "Treatment session";
      case "note":
        return "Clinical note";
      case "report":
        return "Report";
      default:
        return "Event";
    }
  };

  return (
    <div className="patient-history-card">
      <div className="patient-history-header">
        <h2 className="patient-history-title">Patient history</h2>

        <div className="patient-history-filters">
          <select
            className="history-filter-select"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="all">All types</option>
            <option value="transcription">Transcriptions</option>
            <option value="treatment">Treatments</option>
            <option value="note">Notes</option>
            <option value="report">Reports</option>
          </select>

          <div className="history-search-wrapper">
            <span className="history-search-icon">🔍</span>
            <input
              className="history-search-input"
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search in history"
            />
          </div>
        </div>
      </div>

      <ul className="history-list">
        {filteredEntries.map((entry, index) => {
          const normalizedType = String(entry.type || "").toLowerCase();
          const isTranscription = normalizedType === "transcription";

          const hasVisitNote = Boolean(
            entry.visitNote && entry.visitNote.trim()
          );
          const hasSummary = Boolean(
            entry.summary && entry.summary.trim()
          );
          const hasAudio = Boolean(entry.audioData);

          const itemClass = [
            "history-item",
            isTranscription ? "history-item-transcription" : "",
          ]
            .filter(Boolean)
            .join(" ");

          return (
            <li
              key={entry.id || `${normalizedType || "entry"}-${index}`}
              className={itemClass}
            >
              <div className="history-meta-row">
                <span className="history-meta-type">
                  {typeLabel(entry.type)}
                </span>
                {entry.date && (
                  <span className="history-meta-separator">•</span>
                )}
                {entry.date && (
                  <span className="history-meta-date">
                    {formatDate(entry.date)}
                  </span>
                )}

                {hasAudio && (
                  <span className="history-meta-audio-tag">
                    🎧 Audio recorded
                  </span>
                )}
              </div>

              {hasVisitNote && (
                <div className="history-visit-note">
                  {entry.visitNote}
                </div>
              )}

              {hasSummary && (
                <div
                  className={
                    isTranscription
                      ? "history-summary history-summary-transcription"
                      : "history-summary"
                  }
                >
                  {entry.summary}
                </div>
              )}

              {!hasVisitNote && !hasSummary && hasAudio && (
                <div className="history-summary history-summary-audio-only">
                  Audio only visit (no text transcription).
                </div>
              )}

              {hasAudio && (
                <div className="history-audio">
                  <audio
                    controls
                    preload="metadata"
                    src={entry.audioData}
                    onError={(e) => {
                      console.error("[PatientHistory] Failed to load audio for history entry:", entry.id, e);
                      // Try to fix audio data format if it's not a data URL
                      if (entry.audioData && !entry.audioData.startsWith("data:")) {
                        console.warn("[PatientHistory] Audio data might not be in correct format (data URL expected)");
                        // Try to construct data URL if it's base64 without prefix
                        if (entry.audioData && entry.audioData.length > 100) {
                          // Might be base64 without data URL prefix
                          console.warn("[PatientHistory] Audio data exists but format might be incorrect - expected data URL format");
                        }
                      }
                    }}
                    onLoadStart={() => {
                      if (import.meta.env.DEV) {
                        console.log(`[PatientHistory] Loading audio for entry ${entry.id}, data length: ${entry.audioData?.length || 0}`);
                      }
                    }}
                    onCanPlay={() => {
                      if (import.meta.env.DEV) {
                        console.log(`[PatientHistory] Audio ready to play for entry ${entry.id}`);
                      }
                    }}
                  />
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default PatientHistory;
