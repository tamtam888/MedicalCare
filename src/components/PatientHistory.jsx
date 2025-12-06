// src/components/PatientHistory.jsx
import React, { useMemo, useState } from "react";

function PatientHistory({ patient }) {
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");

  const allEntries = useMemo(
    () => [...(patient?.history || [])],
    [patient?.history]
  );

  const filteredEntries = useMemo(() => {
    let entries = [...allEntries];

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

    return entries.sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
  }, [allEntries, filterType, searchText]);

  if (allEntries.length === 0) {
    return <p className="empty-state">No history available</p>;
  }

  return (
    <div className="history-container">
      <div className="history-filters">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="history-filter-select"
        >
          <option value="all">All types</option>
          <option value="Session">Sessions</option>
          <option value="Note">Notes</option>
          <option value="CarePlan">Care plans</option>
          <option value="Report">Reports</option>
          <option value="Transcription">Transcriptions</option>
        </select>

        <input
          type="text"
          className="history-search-input"
          placeholder="Search in history"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
        />
      </div>

      <ul className="history-list">
        {filteredEntries.map((entry) => (
          <li key={entry.id} className="history-item">
            <div className="history-item-header">
              <span className="history-item-type">{entry.type}</span>
              <span className="history-item-date">
                {entry.date
                  ? new Date(entry.date).toLocaleDateString()
                  : "-"}
              </span>
            </div>

            {entry.title && (
              <div className="history-item-title">{entry.title}</div>
            )}

            {entry.summary && (
              <div className="history-item-summary">{entry.summary}</div>
            )}

            {entry.audioData && (
              <div className="history-item-audio">
                <p className="history-item-audio-label">Audio recording:</p>
                <audio controls src={entry.audioData} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PatientHistory;
