import React, { useMemo, useState, useEffect } from "react";

function normalizeEntries(history) {
  return Array.isArray(history) ? history : [];
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

function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function toInputDate(value) {
  if (!value) return todayISO();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return todayISO();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function fromInputDate(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function createEntry() {
  return {
    id: crypto?.randomUUID ? crypto.randomUUID() : `h_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: "Note",
    date: new Date().toISOString(),
    title: "",
    summary: "",
    audioUrl: "",
  };
}

function PatientHistory({
  patient,
  history,
  onChangeHistory,
}) {
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");

  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const allEntries = useMemo(() => {
    const source = history ?? patient?.history;
    return normalizeEntries(source);
  }, [history, patient]);

  useEffect(() => {
    if (editingId && draft) {
      const stillExists = allEntries.some((e) => e.id === editingId);
      if (!stillExists) {
        setEditingId(null);
        setDraft(null);
      }
    }
  }, [allEntries, editingId, draft]);

  const filteredEntries = useMemo(() => {
    let entries = allEntries;

    if (filterType !== "all") {
      entries = entries.filter((entry) => entry.type === filterType);
    }

    const term = searchText.trim().toLowerCase();
    if (term) {
      entries = entries.filter((entry) => {
        const title = (entry.title || "").toLowerCase();
        const summary = (entry.summary || "").toLowerCase();
        return title.includes(term) || summary.includes(term);
      });
    }

    return [...entries].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [allEntries, filterType, searchText]);

  const emitChange = (next) => {
    if (typeof onChangeHistory === "function") {
      onChangeHistory(next);
    }
  };

  const handleAdd = () => {
    const entry = createEntry();
    emitChange([entry, ...allEntries]);
    setEditingId(entry.id);
    setDraft({
      ...entry,
      dateInput: toInputDate(entry.date),
    });
  };

  const handleDelete = (id) => {
    const next = allEntries.filter((e) => e.id !== id);
    emitChange(next);
    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setDraft({
      ...entry,
      dateInput: toInputDate(entry.date),
    });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const handleSaveEdit = () => {
    if (!draft || !editingId) return;

    const updatedEntry = {
      ...draft,
      date: fromInputDate(draft.dateInput),
    };

    delete updatedEntry.dateInput;

    const next = allEntries.map((e) => (e.id === editingId ? updatedEntry : e));
    emitChange(next);
    setEditingId(null);
    setDraft(null);
  };

  const handleDraftChange = (key, value) => {
    setDraft((prev) => ({ ...(prev || {}), [key]: value }));
  };

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

          <button
            type="button"
            className="history-add-button"
            onClick={handleAdd}
          >
            Add entry
          </button>
        </div>
      </div>

      {allEntries.length === 0 ? (
        <p className="empty-state">No history available yet</p>
      ) : null}

      <ul className="history-list">
        {filteredEntries.map((entry) => {
          const isEditing = editingId === entry.id;

          return (
            <li key={entry.id} className="history-item">
              <div className="history-item-header">
                <span className={getTypeClass(entry.type)}>
                  {formatType(entry.type)}
                </span>
                <span className="history-item-date">
                  {entry.date ? new Date(entry.date).toLocaleDateString() : ""}
                </span>

                <div className="history-item-actions">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        className="history-action-btn"
                        onClick={() => handleEdit(entry)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="history-action-btn danger"
                        onClick={() => handleDelete(entry.id)}
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="history-action-btn"
                        onClick={handleSaveEdit}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="history-action-btn"
                        onClick={handleCancelEdit}
                      >
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!isEditing ? (
                <>
                  <div className="history-item-title">
                    {entry.title || "(No title)"}
                  </div>

                  {entry.summary ? (
                    <div className="history-item-summary">{entry.summary}</div>
                  ) : null}

                  {entry.audioUrl ? (
                    <div className="history-item-audio">
                      <span className="history-audio-label">Audio recorded</span>
                      <audio controls src={entry.audioUrl} />
                      {!entry.summary ? (
                        <div className="history-item-summary muted">
                          Audio-only visit (no text transcription).
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="history-edit-form">
                  <div className="history-edit-row">
                    <label className="history-edit-label">Type</label>
                    <select
                      className="history-edit-input"
                      value={draft?.type || "Note"}
                      onChange={(e) => handleDraftChange("type", e.target.value)}
                    >
                      <option value="Transcription">Transcription</option>
                      <option value="Session">Session</option>
                      <option value="Note">Note</option>
                      <option value="CarePlan">CarePlan</option>
                      <option value="Report">Report</option>
                    </select>
                  </div>

                  <div className="history-edit-row">
                    <label className="history-edit-label">Date</label>
                    <input
                      className="history-edit-input"
                      type="date"
                      value={draft?.dateInput || todayISO()}
                      onChange={(e) => handleDraftChange("dateInput", e.target.value)}
                    />
                  </div>

                  <div className="history-edit-row">
                    <label className="history-edit-label">Title</label>
                    <input
                      className="history-edit-input"
                      value={draft?.title || ""}
                      onChange={(e) => handleDraftChange("title", e.target.value)}
                      placeholder="Title"
                    />
                  </div>

                  <div className="history-edit-row">
                    <label className="history-edit-label">Summary</label>
                    <textarea
                      className="history-edit-textarea"
                      value={draft?.summary || ""}
                      onChange={(e) => handleDraftChange("summary", e.target.value)}
                      placeholder="Summary"
                      rows={3}
                    />
                  </div>

                  <div className="history-edit-row">
                    <label className="history-edit-label">Audio URL</label>
                    <input
                      className="history-edit-input"
                      value={draft?.audioUrl || ""}
                      onChange={(e) => handleDraftChange("audioUrl", e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
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
