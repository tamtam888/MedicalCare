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
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {remoteError ? <p className="empty-state">{remoteError}</p> : null}
    </div>
  );
}

export default PatientHistory;
