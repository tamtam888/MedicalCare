// src/components/PatientHistory.jsx
import React, { useMemo, useState } from "react";


function PatientHistory({ patient }) {
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");

  // In the future you can merge sessions, notes, care plans etc.
  // For now, we use patient.history as a single timeline array.
  const allEntries = patient.history || [];

  const filteredEntries = useMemo(() => {
    let entries = allEntries;

    if (filterType !== "all") {
      entries = entries.filter((entry) => entry.type === filterType);
    }

    if (searchText.trim() !== "") {
      const lower = searchText.toLowerCase();
      entries = entries.filter(
        (entry) =>
          entry.title.toLowerCase().includes(lower) ||
          (entry.summary && entry.summary.toLowerCase().includes(lower))
      );
    }

    return [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
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
                {new Date(entry.date).toLocaleDateString()}
              </span>
            </div>
            <div className="history-item-title">{entry.title}</div>
            {entry.summary && (
              <div className="history-item-summary">{entry.summary}</div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default PatientHistory;
