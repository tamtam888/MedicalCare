import React, { useEffect, useMemo, useState } from "react";
import "./PatientHistory.css";

function normalizeEntries(history) {
  return Array.isArray(history) ? history : [];
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
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function fromInputDate(value) {
  if (!value) return new Date().toISOString();
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return new Date().toISOString();
  return d.toISOString();
}

function createEntry() {
  const id =
    crypto?.randomUUID?.() ?? `h_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return {
    id,
    type: "note",
    date: new Date().toISOString(),
    title: "",
    summary: "",
    audioUrl: "",
    audioData: null,
  };
}

function normalizeType(type) {
  const t = String(type || "").trim();
  if (!t) return "other";
  return t.toLowerCase();
}

function formatType(type) {
  const t = normalizeType(type);
  if (t === "transcription") return "Transcription";
  if (t === "session") return "Session";
  if (t === "note") return "Note";
  if (t === "careplan" || t === "care plan") return "Care plan";
  if (t === "report") return "Report";
  return "Other";
}

function getTypeClass(type) {
  const t = normalizeType(type);
  if (t === "transcription") return "history-type-pill transcription";
  if (t === "session") return "history-type-pill session";
  if (t === "note") return "history-type-pill note";
  if (t === "careplan" || t === "care plan") return "history-type-pill careplan";
  if (t === "report") return "history-type-pill report";
  return "history-type-pill other";
}

function IconPencil(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25Zm2.92 2.33H5v-.92l9.06-9.06.92.92L5.92 19.58ZM20.71 7.04a1.003 1.003 0 0 0 0-1.42L18.37 3.29a1.003 1.003 0 0 0-1.42 0L15.13 5.1l3.75 3.75 1.83-1.81Z"
      />
    </svg>
  );
}

function IconTrash(props) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M9 3h6l1 2h4v2h-2v14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7H4V5h4l1-2Zm-1 4v14h8V7H8Zm2 2h2v10h-2V9Zm4 0h2v10h-2V9Z"
      />
    </svg>
  );
}

export default function PatientHistory({ patient, history, onChangeHistory }) {
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
      const stillExists = allEntries.some((e) => e?.id === editingId);
      if (!stillExists) {
        setEditingId(null);
        setDraft(null);
      }
    }
  }, [allEntries, editingId, draft]);

  const filteredEntries = useMemo(() => {
    let entries = allEntries;

    if (filterType !== "all") {
      entries = entries.filter((entry) => normalizeType(entry?.type) === normalizeType(filterType));
    }

    const term = searchText.trim().toLowerCase();
    if (term) {
      entries = entries.filter((entry) => {
        const title = String(entry?.title || "").toLowerCase();
        const summary = String(entry?.summary || "").toLowerCase();
        return title.includes(term) || summary.includes(term);
      });
    }

    return [...entries].sort(
      (a, b) => new Date(b?.date || 0).getTime() - new Date(a?.date || 0).getTime()
    );
  }, [allEntries, filterType, searchText]);

  const emitChange = (next) => {
    if (typeof onChangeHistory === "function") onChangeHistory(next);
  };

  const handleAdd = () => {
    const entry = createEntry();
    const next = [entry, ...allEntries];
    emitChange(next);

    setEditingId(entry.id);
    setDraft({ ...entry, dateInput: toInputDate(entry.date) });
  };

  const handleDelete = (id) => {
    const next = allEntries.filter((e) => e?.id !== id);
    emitChange(next);

    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setDraft({ ...entry, dateInput: toInputDate(entry.date) });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setDraft(null);
  };

  const handleSaveEdit = () => {
    if (!draft || !editingId) return;

    const updatedEntry = {
      ...draft,
      type: normalizeType(draft.type),
      date: fromInputDate(draft.dateInput),
    };
    delete updatedEntry.dateInput;

    const next = allEntries.map((e) => (e?.id === editingId ? updatedEntry : e));
    emitChange(next);

    setEditingId(null);
    setDraft(null);
  };

  const handleDraftChange = (key, value) => {
    setDraft((prev) => ({ ...(prev || {}), [key]: value }));
  };

  return (
    <div className="patient-history-card">
      <div className="patient-history-header">
        <h3 className="patient-history-title">Patient history</h3>

        <div className="patient-history-filters">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="history-filter-select"
          >
            <option value="all">All types</option>
            <option value="transcription">Transcriptions</option>
            <option value="session">Sessions</option>
            <option value="note">Notes</option>
            <option value="careplan">Care plans</option>
            <option value="report">Reports</option>
          </select>

          <div className="history-search-wrapper">
            <span className="history-search-icon">⌕</span>
            <input
              type="text"
              className="history-search-input"
              placeholder="Search in history"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </div>

          <button type="button" className="history-add-button" onClick={handleAdd}>
            Add entry
          </button>
        </div>
      </div>

      {allEntries.length === 0 ? (
        <div className="empty-history">
          <p className="history-empty-text">No history available yet.</p>
        </div>
      ) : null}

      <ul className="history-list">
        {filteredEntries.map((entry) => {
          const isEditing = editingId === entry?.id;

          // Audio might be stored as audioUrl OR audioData (data url / blob url)
          const audioSrc = entry?.audioUrl || entry?.audioData || "";

          return (
            <li
              key={entry?.id}
              className={`history-item ${
                normalizeType(entry?.type) === "transcription" ? "history-item-transcription" : ""
              }`}
            >
              <div className="history-item-top">
                <div className="history-meta-row">
                  <span className={getTypeClass(entry?.type)}>{formatType(entry?.type)}</span>
                  <span className="history-meta-separator">•</span>
                  <span className="history-meta-date">
                    {entry?.date ? new Date(entry.date).toLocaleDateString() : ""}
                  </span>
                </div>

                <div className="history-item-actions">
                  {!isEditing ? (
                    <>
                      <button
                        type="button"
                        className="history-icon-btn"
                        aria-label="Edit entry"
                        title="Edit"
                        onClick={() => handleEdit(entry)}
                      >
                        <IconPencil className="history-icon" />
                      </button>

                      <button
                        type="button"
                        className="history-icon-btn danger"
                        aria-label="Delete entry"
                        title="Delete"
                        onClick={() => handleDelete(entry?.id)}
                      >
                        <IconTrash className="history-icon" />
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="history-pill-btn primary"
                        onClick={handleSaveEdit}
                      >
                        Save
                      </button>
                      <button type="button" className="history-pill-btn" onClick={handleCancelEdit}>
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>

              {!isEditing ? (
                <>
                  <div className="history-title-line">{entry?.title || "(No title)"}</div>

                  {entry?.summary ? (
                    <div
                      className={`history-summary ${
                        normalizeType(entry?.type) === "transcription"
                          ? "history-summary-transcription"
                          : ""
                      }`}
                    >
                      {entry.summary}
                    </div>
                  ) : null}

                  {audioSrc ? (
                    <div className="history-audio">
                      <audio controls preload="metadata" src={audioSrc} />
                      {!entry?.summary ? (
                        <div className="history-summary history-summary-audio-only">
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
                      value={draft?.type || "note"}
                      onChange={(e) => handleDraftChange("type", e.target.value)}
                    >
                      <option value="transcription">Transcription</option>
                      <option value="session">Session</option>
                      <option value="note">Note</option>
                      <option value="careplan">CarePlan</option>
                      <option value="report">Report</option>
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
