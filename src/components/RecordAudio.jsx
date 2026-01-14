// src/components/RecordAudio.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import "./RecordAudio.css";
import { saveAudioBlob, deleteAudioBlob } from "../utils/audioStorage";

function pickMimeType() {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/ogg"];
  return types.find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t)) || "";
}

function improveTranscriptionLocal(text) {
  if (!text) return "";
  let result = text.trim().replace(/\s+/g, " ");
  if (!/[.!?]$/.test(result)) result += ".";
  return `Clinical summary: ${result.charAt(0).toUpperCase()}${result.slice(1)}`;
}

async function improveTranscriptionViaServer(text, { signal } = {}) {
  const res = await fetch("http://localhost:3001/api/ai/improve-visit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
    signal,
  });

  if (!res.ok) {
    let extra = "";
    try {
      extra = await res.text();
    } catch {}
    throw new Error(`Improve API failed (${res.status})${extra ? `: ${extra}` : ""}`);
  }

  const data = await res.json().catch(() => ({}));
  const out = data?.text ?? data?.improvedText ?? data?.result;
  if (typeof out !== "string" || !out.trim()) throw new Error("Improve API returned empty text");
  return out.trim();
}

export default function RecordAudio({ selectedPatient, onSaveTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [isImproving, setIsImproving] = useState(false);

  const [audioId, setAudioId] = useState(null);
  const [audioURL, setAudioURL] = useState("");
  const [transcription, setTranscription] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const audioPreviewUrlRef = useRef("");
  const dictationWantedRef = useRef(false);

  const improveAbortRef = useRef(null);

  const canUseSpeechRecognition =
    typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

  const patientKey = useMemo(() => {
    if (!selectedPatient) return null;
    return selectedPatient.idNumber || selectedPatient.id || selectedPatient.identifier || null;
  }, [selectedPatient]);

  useEffect(() => {
    return () => {
      try {
        mediaRecorderRef.current?.stop();
        mediaRecorderRef.current?.stream?.getTracks?.().forEach((t) => t.stop());
      } catch {}
      try {
        dictationWantedRef.current = false;
        recognitionRef.current?.stop();
      } catch {}
      if (audioPreviewUrlRef.current) {
        try {
          URL.revokeObjectURL(audioPreviewUrlRef.current);
        } catch {}
        audioPreviewUrlRef.current = "";
      }
      try {
        improveAbortRef.current?.abort?.();
      } catch {}
    };
  }, []);

  const resetDraftUIOnly = () => {
    if (audioPreviewUrlRef.current) {
      try {
        URL.revokeObjectURL(audioPreviewUrlRef.current);
      } catch {}
      audioPreviewUrlRef.current = "";
    }
    setAudioURL("");
    setAudioId(null);
    setTranscription("");
    setStatusMessage("");
  };

  const stopDictationIfRunning = () => {
    if (!isDictating) return;
    dictationWantedRef.current = false;
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsDictating(false);
  };

  const handleStartRecording = async () => {
    if (!selectedPatient || isRecording) return;

    stopDictationIfRunning();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      const mimeType = pickMimeType();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];

        const id = crypto?.randomUUID?.() ?? `a_${Date.now()}_${Math.random().toString(16).slice(2)}`;
        await saveAudioBlob(id, blob);

        if (audioPreviewUrlRef.current) {
          try {
            URL.revokeObjectURL(audioPreviewUrlRef.current);
          } catch {}
          audioPreviewUrlRef.current = "";
        }

        const url = URL.createObjectURL(blob);
        audioPreviewUrlRef.current = url;

        setAudioId(id);
        setAudioURL(url);
        setStatusMessage("Recording saved.");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setStatusMessage("Recording in progress...");
    } catch (error) {
      console.error("Microphone error:", error);
      alert("Could not access microphone.");
      setStatusMessage("Microphone access failed.");
    }
  };

  const handleStopRecording = () => {
    if (!mediaRecorderRef.current) return;
    try {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach((t) => t.stop());
    } catch {}
    mediaRecorderRef.current = null;
    setIsRecording(false);
  };

  const handleToggleDictation = () => {
    if (!canUseSpeechRecognition || !selectedPatient) return;

    if (isDictating) {
      dictationWantedRef.current = false;
      try {
        recognitionRef.current?.stop();
      } catch {}
      setIsDictating(false);
      setStatusMessage("Dictation stopped.");
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event) => {
      let chunk = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const r = event.results[i];
        if (r.isFinal) chunk += ` ${r[0].transcript}`;
      }
      if (chunk.trim()) {
        setTranscription((prev) => `${(prev || "").trim()} ${chunk.trim()}`.trim());
      }
    };

    recognition.onerror = (event) => {
      console.error("SpeechRecognition error:", event?.error, event);
      dictationWantedRef.current = false;
      setIsDictating(false);
      setStatusMessage(`Dictation error${event?.error ? `: ${event.error}` : "."}`);
    };

    recognition.onend = () => {
      if (dictationWantedRef.current) {
        try {
          recognition.start();
          return;
        } catch (e) {
          console.error("SpeechRecognition restart failed:", e);
          dictationWantedRef.current = false;
        }
      }
      setIsDictating(false);
    };

    recognitionRef.current = recognition;
    dictationWantedRef.current = true;

    try {
      recognition.start();
      setIsDictating(true);
      setStatusMessage("Dictation in progress...");
    } catch (e) {
      console.error("SpeechRecognition start failed:", e);
      dictationWantedRef.current = false;
      setIsDictating(false);
      setStatusMessage("Dictation error.");
    }
  };

  const handleImprove = async () => {
    const t = (transcription || "").trim();
    if (!t || isImproving) return;

    setIsImproving(true);
    setStatusMessage("Improving transcription...");

    try {
      try {
        improveAbortRef.current?.abort?.();
      } catch {}
      const controller = new AbortController();
      improveAbortRef.current = controller;

      let improvedText = "";
      try {
        improvedText = await improveTranscriptionViaServer(t, { signal: controller.signal });
      } catch (err) {
        console.warn("Improve via server failed, using local fallback:", err);
        improvedText = improveTranscriptionLocal(t);
      }

      setTranscription(improvedText);
      setStatusMessage("Transcription improved.");
    } catch (error) {
      console.error("Improve failed:", error);
      setStatusMessage("Improve failed.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleClear = async () => {
    if (audioId) {
      await deleteAudioBlob(audioId);
    }
    resetDraftUIOnly();
    setStatusMessage("Cleared.");
  };

  const handleSave = () => {
    if (!selectedPatient || typeof onSaveTranscription !== "function") return;

    const text = (transcription || "").trim();
    const hasAudio = Boolean(audioId);

    if (!text && !hasAudio) {
      alert("Nothing to save. Please record audio or add transcription text.");
      return;
    }

    const payload = {
      text,
      audioId: audioId || null,
      patientId: patientKey,
      createdAt: Date.now(),
    };

    try {
      if (onSaveTranscription.length <= 1) onSaveTranscription(payload);
      else onSaveTranscription(patientKey, text, audioId || null);

      resetDraftUIOnly();
      setStatusMessage("Saved to patient history.");
    } catch (error) {
      console.error("Failed to save transcription:", error);
      alert("Failed to save. Please try again.");
    }
  };

  const patientLabel = selectedPatient
    ? `${selectedPatient.firstName || ""} ${selectedPatient.lastName || ""} (ID ${
        selectedPatient.idNumber || ""
      })`
    : "No patient selected";

  return (
    <div className="record-audio-container">
      <div className="record-header">
        <h3 className="record-title">Record & transcription</h3>
        <p className="record-subtitle">
          Recording for: <span className="record-patient">{patientLabel}</span>
        </p>
      </div>

      <div className="record-controls-row">
        <button
          type="button"
          className={`record-btn record-btn-main ${isRecording ? "record-btn-active" : ""}`}
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={!selectedPatient}
        >
          {isRecording ? "Stop audio recording" : "Start audio recording"}
        </button>

        <button
          type="button"
          className={`record-btn record-btn-secondary ${isDictating ? "record-btn-active" : ""}`}
          onClick={handleToggleDictation}
          disabled={!selectedPatient || !canUseSpeechRecognition || isRecording}
          title={isRecording ? "Stop recording to start dictation" : ""}
        >
          {isDictating ? "Stop dictation" : "Start dictation"}
        </button>
      </div>

      <div className="transcription-block">
        <div className="transcription-header">
          <span className="details-label">Transcription (editable)</span>
        </div>

        <textarea
          className="transcription-textarea"
          value={transcription}
          placeholder="Type or edit the session transcription here."
          onChange={(e) => setTranscription(e.target.value)}
        />

        <div className="record-footer-buttons">
          <button type="button" className="record-footer-btn record-save-btn" onClick={handleSave}>
            Save transcription
          </button>

          <button
            type="button"
            className="record-footer-btn record-ai-btn"
            onClick={handleImprove}
            disabled={!transcription.trim() || isImproving}
          >
            Improve with AI
          </button>

          <button
            type="button"
            className="record-footer-btn record-clear-btn"
            onClick={handleClear}
            disabled={!transcription && !audioId}
          >
            Clear
          </button>
        </div>
      </div>

      {audioURL && (
        <div className="audio-preview">
          <audio controls preload="metadata" src={audioURL} />
        </div>
      )}

      <div className="record-status-line">{statusMessage}</div>
    </div>
  );
}
