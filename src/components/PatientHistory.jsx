<<<<<<< HEAD
import { useMemo, useEffect, useState } from "react";
import { medplum } from "../medplumClient";

function isBlobUrl(v) {
  return typeof v === "string" && v.startsWith("blob:");
}

function isDataUrl(v) {
  return typeof v === "string" && v.startsWith("data:");
}

function isProbablyBrokenDataUrl(v) {
  if (!isDataUrl(v)) return false;
  return v.length < 200;
}

function getAudioSrc(entry) {
  return (
    entry.audioUrl ||
    entry.audioData ||
    entry.audioSrc ||
    entry.audio ||
    entry.recordingUrl ||
    ""
  );
}

function getAudioType(entry) {
  return entry.audioMimeType || entry.mimeType || "";
}

function base64ToTextUtf8(b64) {
  if (!b64 || typeof b64 !== "string") return "";
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch {
    return "";
  }
}

function normalizeBinaryRef(url) {
  if (!url || typeof url !== "string") return null;
  if (url.startsWith("Binary/")) return url;
  const m = url.match(/\/Binary\/([A-Za-z0-9\-.]{1,})/);
  if (m?.[1]) return `Binary/${m[1]}`;
  return null;
}

async function resolvePatientFhirIdFromIdNumber(idNumber) {
  if (!idNumber) return null;

  const p = await medplum.searchOne("Patient", {
    identifier: String(idNumber),
  });

  return p?.id || null;
}

async function binaryToDataUrl(binaryRef, contentTypeFallback) {
  const ref = normalizeBinaryRef(binaryRef);
  if (!ref) return "";

  const id = ref.split("/")[1];
  if (!id) return "";

  const binary = await medplum.readResource("Binary", id);
  const ct =
    binary?.contentType ||
    contentTypeFallback ||
    "application/octet-stream";
  const data = binary?.data || "";
  if (!data) return "";
  return `data:${ct};base64,${data}`;
}

function mapDocRefToEntry(docRef) {
  const content = Array.isArray(docRef?.content) ? docRef.content : [];

  const textPart = content.find(
    (c) =>
      c?.attachment?.contentType?.startsWith("text/") ||
      c?.attachment?.contentType === "text/plain"
  );

  const audioPart = content.find(
    (c) => c?.attachment?.contentType?.startsWith("audio/") || c?.attachment?.url
  );

  const text = base64ToTextUtf8(textPart?.attachment?.data || "");
  const audioUrl = audioPart?.attachment?.url || "";
  const audioMimeType = audioPart?.attachment?.contentType || "";

  const identifierValue =
    Array.isArray(docRef?.identifier) && docRef.identifier.length > 0
      ? docRef.identifier[0]?.value
      : "";

  return {
    id:
      identifierValue ||
      docRef?.id ||
      `${Date.now()}_${Math.random().toString(16).slice(2)}`,
    type: "Transcription",
    title: "Treatment transcription",
    summary: text || "",
    date: docRef?.date || docRef?.meta?.lastUpdated || new Date().toISOString(),
    audioUrl: audioUrl || "",
    audioData: audioUrl || "",
    audioMimeType: audioMimeType || "",
  };
}

function dedupeById(entries) {
  const map = new Map();
  for (const e of entries) {
    if (!e?.id) continue;
    map.set(e.id, e);
  }
  return Array.from(map.values());
}

function PatientHistory({ patient, onCleanupHistory }) {
  const [filterType, setFilterType] = useState("all");
  const [searchText, setSearchText] = useState("");
  const [remoteEntries, setRemoteEntries] = useState([]);
  const [remoteError, setRemoteError] = useState("");

  const allEntriesLocal = useMemo(
    () => [...(patient?.history || [])],
    [patient?.history]
  );

  const patientIdNumber = useMemo(() => {
    return patient?.idNumber ?? patient?.identifier ?? "";
  }, [patient]);

  useEffect(() => {
    let cancelled = false;

    async function loadFromMedplum() {
      setRemoteError("");

      if (!patientIdNumber) {
        setRemoteEntries([]);
        return;
      }

      try {
        const fhirId = await resolvePatientFhirIdFromIdNumber(patientIdNumber);
        if (!fhirId) {
          if (!cancelled) setRemoteEntries([]);
          return;
        }

        const bundle = await medplum.search("DocumentReference", {
          subject: `Patient/${fhirId}`,
          _count: "200",
          _sort: "-date",
        });

        const docs = Array.isArray(bundle?.entry)
          ? bundle.entry.map((e) => e.resource).filter(Boolean)
          : [];

        const mapped = docs.map(mapDocRefToEntry);

        const withAudio = await Promise.all(
          mapped.map(async (entry) => {
            const src = getAudioSrc(entry);
            const type = getAudioType(entry);
            const binaryRef = normalizeBinaryRef(src);

            if (binaryRef) {
              try {
                const dataUrl = await binaryToDataUrl(binaryRef, type);
                if (dataUrl) {
                  return {
                    ...entry,
                    audioUrl: dataUrl,
                    audioData: dataUrl,
                    audioMimeType: type || entry.audioMimeType || "",
                  };
                }
              } catch (error) {
                console.error(error);
                return entry;
              }
            }

            return entry;
          })
        );

        if (!cancelled) {
          setRemoteEntries(withAudio);
        }
      } catch (error) {
        console.error(error);
        if (!cancelled) {
          setRemoteEntries([]);
          setRemoteError("Failed to load history from Medplum.");
        }
      }
    }

    loadFromMedplum();

    return () => {
      cancelled = true;
    };
  }, [patientIdNumber]);

  const allEntries = useMemo(() => {
    const merged = dedupeById([...(remoteEntries || []), ...(allEntriesLocal || [])]);
    return merged;
  }, [remoteEntries, allEntriesLocal]);

  useEffect(() => {
    if (!Array.isArray(allEntries) || allEntries.length === 0) return;

    const cleaned = allEntries.filter((entry) => {
      const src = getAudioSrc(entry);
      if (!src) return true;
      if (isBlobUrl(src)) return false;
      if (isProbablyBrokenDataUrl(src)) return false;
      return true;
    });

    if (
      cleaned.length !== allEntries.length &&
      typeof onCleanupHistory === "function"
    ) {
      onCleanupHistory(cleaned);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient?.history, remoteEntries]);

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
      (a, b) =>
        new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
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
          onChange={(event) => setFilterType(event.target.value)}
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
          onChange={(event) => setSearchText(event.target.value)}
        />
      </div>

      <ul className="history-list">
        {filteredEntries.map((entry) => {
          const audioSrc = getAudioSrc(entry);
          const audioType = getAudioType(entry);

          const audioIsBroken =
            (audioSrc && isBlobUrl(audioSrc)) ||
            isProbablyBrokenDataUrl(audioSrc);

          return (
            <li key={entry.id} className="history-item">
              <div className="history-item-header">
                <span className="history-item-type">{entry.type}</span>
                <span className="history-item-date">
                  {entry.date ? new Date(entry.date).toLocaleDateString() : "-"}
                </span>
              </div>

              {entry.title && (
                <div className="history-item-title">{entry.title}</div>
              )}

              {entry.summary && (
                <div className="history-item-summary">{entry.summary}</div>
              )}

              {audioSrc && !audioIsBroken && (
                <div className="history-item-audio">
                  <p className="history-item-audio-label">Audio recording:</p>
                  <audio controls preload="metadata">
                    {audioType ? (
                      <source src={audioSrc} type={audioType} />
                    ) : (
                      <source src={audioSrc} />
                    )}
                    Your browser does not support the audio element.
                  </audio>
                </div>
              )}

              {audioSrc && audioIsBroken && (
                <div className="history-item-audio">
                  <p className="history-item-audio-label">
                    Audio recording unavailable (old/broken recording).
                  </p>
=======
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
>>>>>>> refactor-ui-cleanup
                </div>
              )}
            </li>
          );
        })}
      </ul>
<<<<<<< HEAD

      {remoteError ? <p className="empty-state">{remoteError}</p> : null}
    </div>
  );
}

export default PatientHistory;
=======
    </div>
  );
}
>>>>>>> refactor-ui-cleanup
