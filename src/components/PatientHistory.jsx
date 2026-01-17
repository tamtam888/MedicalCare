import React, { useEffect, useMemo, useState } from "react";
import "./PatientHistory.css";
import { loadAudioBlob } from "../utils/audioStorage";
import { formatDateDMY, toISODateInput, fromISODateInput } from "../utils/dateFormat";
import { capitalizeSentences } from "../utils/textFormatters";

function normalizeEntries(history) {
  return Array.isArray(history) ? history : [];
}

function createEntry() {
  const id = crypto?.randomUUID?.() ?? `h_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  return {
    id,
    type: "note",
    date: new Date().toISOString(),
    title: "",
    summary: "",
    audioUrl: "",
    audioData: null,
    audioId: "",
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

function normalizeText(s) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function timeBucket(dateValue, bucketMs = 2000) {
  const t = new Date(dateValue || 0).getTime();
  if (!Number.isFinite(t)) return 0;
  return Math.floor(t / bucketMs);
}

function entrySignature(entry) {
  const type = normalizeType(entry?.type);
  const title = normalizeText(entry?.title);
  const summary = normalizeText(entry?.summary);
  const audioId = String(entry?.audioId || "");
  const audioUrl = String(entry?.audioUrl || "");
  const audioData = String(entry?.audioData || "");
  const bucket = timeBucket(entry?.date, 2000);
  return `${type}|${bucket}|${title}|${summary}|${audioId}|${audioUrl}|${audioData}`;
}

function dedupeHistory(entries) {
  const arr = normalizeEntries(entries);
  const sorted = [...arr].sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));

  const seenById = new Set();
  const seenBySig = new Set();
  const result = [];

  for (const e of sorted) {
    if (!e) continue;

    const id = String(e.id || "");
    if (id && seenById.has(id)) continue;
    if (id) seenById.add(id);

    const sig = entrySignature(e);
    if (seenBySig.has(sig)) continue;
    seenBySig.add(sig);

    result.push(e);
  }

  return result;
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

function isPlayableUrl(value) {
  const s = String(value || "").trim();
  if (!s) return false;
  return s.startsWith("http://") || s.startsWith("https://") || s.startsWith("data:") || s.startsWith("blob:");
}

function asAudioIdMaybe(value) {
  const s = String(value || "").trim();
  if (!s) return "";
  if (isPlayableUrl(s)) return "";
  return s;
}

function AudioFromId({ audioId }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let revokeUrl = "";

    async function run() {
      setError("");
      setSrc("");
      if (!audioId) return;

      try {
        const blob = await loadAudioBlob(audioId);
        if (!blob) {
          setError("Audio file not found.");
          return;
        }
        const url = URL.createObjectURL(blob);
        revokeUrl = url;
        setSrc(url);
      } catch {
        setError("Failed to load audio.");
      }
    }

    run();

    return () => {
      if (revokeUrl) URL.revokeObjectURL(revokeUrl);
    };
  }, [audioId]);

  if (error) return <div className="history-summary history-summary-audio-only">{error}</div>;
  if (!src) return null;

  return <audio controls preload="metadata" src={src} />;
}

export default function PatientHistory({ patient, history, onChangeHistory, selectedIds, onToggleSelected }) {
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(null);

  const allEntries = useMemo(() => {
    const source = history ?? patient?.history ?? [];
    return dedupeHistory(source);
  }, [history, patient?.history]);

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

    return [...entries].sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));
  }, [allEntries, filterType, searchText]);

  const emitChange = (next) => {
    if (typeof onChangeHistory === "function") {
      onChangeHistory(dedupeHistory(next));
    }
  };

  const handleAdd = () => {
    const entry = createEntry();
    emitChange([entry, ...allEntries]);
    setEditingId(entry.id);
    setDraft({ ...entry, dateInput: toISODateInput(entry.date) });
  };

  const handleDelete = (id) => {
    emitChange(allEntries.filter((e) => e?.id !== id));
    if (editingId === id) {
      setEditingId(null);
      setDraft(null);
    }
  };

  const handleEdit = (entry) => {
    setEditingId(entry.id);
    setDraft({ ...entry, dateInput: toISODateInput(entry.date) });
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
      date: fromISODateInput(draft.dateInput),
      title: capitalizeSentences(draft.title || ""),
      summary: capitalizeSentences(draft.summary || ""),
    };
    delete updatedEntry.dateInput;

    emitChange(allEntries.map((e) => (e?.id === editingId ? updatedEntry : e)));

    setEditingId(null);
    setDraft(null);
  };

  const handleDraftChange = (key, value) => {
    setDraft((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const handleDraftBlurCapitalize = (key) => {
    setDraft((prev) => {
      const next = { ...(prev || {}) };
      next[key] = capitalizeSentences(next[key] || "");
      return next;
    });
  };

  const isSelected = (entryId) => {
    if (!selectedIds || typeof selectedIds.has !== "function") return false;
    return selectedIds.has(String(entryId || ""));
  };

  const toggleSelected = (entryId) => {
    if (typeof onToggleSelected === "function") onToggleSelected(entryId);
  };

  return (
    <div className="patient-history-card">
      <div className="patient-history-header">
        <h3 className="patient-history-title">Patient history</h3>

        <div className="patient-history-filters">
          <select value={filterType} onChange={(e) => setFilterType(e.target.value)} className="history-filter-select">
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

      {allEntries.length === 0 && (
        <div className="empty-history">
          <p className="history-empty-text">No history available yet.</p>
        </div>
      )}

      <ul className="history-list">
        {filteredEntries.map((entry) => {
          const isEditing = editingId === entry?.id;

          const audioUrl = entry?.audioUrl || "";
          const audioData = entry?.audioData || "";
          const audioId = entry?.audioId || "";

          const directUrl = isPlayableUrl(audioUrl)
            ? String(audioUrl)
            : isPlayableUrl(audioData)
              ? String(audioData)
              : "";
          const effectiveAudioId = String(audioId || "").trim() || asAudioIdMaybe(audioData);

          const checked = isSelected(entry?.id);

          return (
            <li
              key={entry?.id}
              className={`history-item ${normalizeType(entry?.type) === "transcription" ? "history-item-transcription" : ""}`}
            >
              <div className="history-item-top">
                <div className="history-meta-row">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSelected(entry?.id)}
                    aria-label="Select visit"
                    className="history-select-circle"
                  />

                  <span className={getTypeClass(entry?.type)}>{formatType(entry?.type)}</span>
                  <span className="history-meta-separator">•</span>
                  <span className="history-meta-date" dir="ltr">
                    {formatDateDMY(entry?.date)}
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
                      <button type="button" className="history-pill-btn primary" onClick={handleSaveEdit}>
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

                  {entry?.summary && (
                    <div
                      className={`history-summary ${normalizeType(entry?.type) === "transcription" ? "history-summary-transcription" : ""}`}
                    >
                      {entry.summary}
                    </div>
                  )}

                  {directUrl ? (
                    <div className="history-audio">
                      <audio controls preload="metadata" src={directUrl} />
                      {!entry?.summary && (
                        <div className="history-summary history-summary-audio-only">
                          Audio-only visit (no text transcription).
                        </div>
                      )}
                    </div>
                  ) : effectiveAudioId ? (
                    <div className="history-audio">
                      <AudioFromId audioId={effectiveAudioId} />
                      {!entry?.summary && (
                        <div className="history-summary history-summary-audio-only">
                          Audio-only visit (no text transcription).
                        </div>
                      )}
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
                      value={draft?.dateInput || toISODateInput(new Date())}
                      onChange={(e) => handleDraftChange("dateInput", e.target.value)}
                    />
                  </div>

                  <div className="history-edit-row">
                    <label className="history-edit-label">Title</label>
                    <input
                      className="history-edit-input"
                      value={draft?.title || ""}
                      onChange={(e) => handleDraftChange("title", e.target.value)}
                      onBlur={() => handleDraftBlurCapitalize("title")}
                      placeholder="Title"
                    />
                  </div>

                  <div className="history-edit-row">
                    <label className="history-edit-label">Summary</label>
                    <textarea
                      className="history-edit-textarea"
                      value={draft?.summary || ""}
                      onChange={(e) => handleDraftChange("summary", e.target.value)}
                      onBlur={() => handleDraftBlurCapitalize("summary")}
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

                  <div className="history-edit-row">
                    <label className="history-edit-label">Audio ID</label>
                    <input
                      className="history-edit-input"
                      value={draft?.audioId || ""}
                      onChange={(e) => handleDraftChange("audioId", e.target.value)}
                      placeholder="IndexedDB audio id"
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
