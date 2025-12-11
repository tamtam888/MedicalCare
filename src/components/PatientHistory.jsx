// src/components/PatientHistory.jsx
import React, { useMemo, useState } from "react";

function normalizeEntries(history) {
  if (!Array.isArray(history)) return [];
  return history;
}

function formatType(type) {
  if (!type) return "Other";
  if (type === "Transcription") return "Transcription";
  if (type === "Session") return "Session";
  if (type === "Note") return "Note";
  if (type === "CarePlan") return "Care plan";
  if (type === "Report") return "Report";
  return type;
}

function getTypeClass(type) {
  const t = (type || "").toLowerCase();
  if (t === "transcription") return "history-type-pill transcription";
  if (t === "session") return "history-type-pill session";
  if (t === "note") return "history-type-pill note";
  if (t === "careplan" || t === "care plan") return "history-type-pill careplan";
  if (t === "report") return "history-type-pill report";
  return "history-type-pill other";
}

function PatientHistory({ patient }) {
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");

  const allEntries = normalizeEntries(patient?.history);

  const filteredEntries = useMemo(() => {
    let entries = allEntries;

    if (filterType !== "all") {
      entries = entries.filter((entry) => entry.type === filterType);
    }

    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      entries = entries.filter((entry) => {
        const title = (entry.title || "").toLowerCase();
        const summary = (entry.summary || "").toLowerCase();
        return title.includes(lower) || summary.includes(lower);
      });
    }

    return [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [allEntries, filterType, searchText]);

  if (!allEntries || allEntries.length === 0) {
    return <p className="empty-state">No history available yet</p>;
  }

  return (
    <div className="history-container">
      <div className="history-header-row">
        <h3 className="history-title">Patient history</h3>

        <div className="history-filters">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="history-filter-select"
          >
            <option value="all">All types</option>
            <option value="Transcription">Transcriptions</option>
            <option value="Session">Sessions</option>
            <option value="Note">Notes</option>
            <option value="CarePlan">Care plans</option>
            <option value="Report">Reports</option>
          </select>

          <div className="history-search-wrapper">
            <input
              type="text"
              className="history-search-input"
              placeholder="Search in history"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>
        </div>
      </div>

      <ul className="history-list">
        {filteredEntries.map((entry) => (
          <li key={entry.id} className="history-item">
            <div className="history-item-header">
              <span className={getTypeClass(entry.type)}>
                {formatType(entry.type)}
              </span>
              <span className="history-item-date">
                {entry.date
                  ? new Date(entry.date).toLocaleDateString()
                  : ""}
              </span>
            </div>

            <div className="history-item-title">
              {entry.title || "(No title)"}
            </div>

            {entry.summary && (
              <div className="history-item-summary">{entry.summary}</div>
            )}

            {entry.audioUrl && (
              <div className="history-item-audio">
                <span className="history-audio-label">Audio recorded</span>
                <audio controls src={entry.audioUrl} />
                {!entry.summary && (
                  <div className="history-item-summary muted">
                    Audio-only visit (no text transcription).
                  </div>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PatientHistory;
