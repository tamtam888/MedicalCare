import { useEffect, useMemo, useRef, useState } from "react";
import "./RecordAudio.css";
import { syncLocalSessionsToMedplum } from "../services/medplumSync";

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}

function pickBestMimeType() {
  if (typeof window === "undefined") return "";
  const MR = window.MediaRecorder;
  if (!MR || !MR.isTypeSupported) return "";

  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mpeg",
    "audio/wav",
  ];

  return candidates.find((t) => MR.isTypeSupported(t)) || "";
}

async function improveRewrite({ patientId, text, patient }) {
  const res = await fetch(
    `/api/patients/${encodeURIComponent(patientId)}/ai-improve`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, patient }),
    }
  );

  if (!res.ok) {
    const msg = await res.text().catch((error) => {
      console.error(error);
      return "";
    });
    throw new Error(msg || "Improve request failed");
  }

  const data = await res.json().catch((error) => {
    console.error(error);
    return {};
  });
  return (data?.improvedText || "").toString().trim();
}

function RecordAudio({ selectedPatient, onSaveTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [transcription, setTranscription] = useState("");
  const [audioDataUrl, setAudioDataUrl] = useState("");
  const [audioMimeType, setAudioMimeType] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [isImproving, setIsImproving] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);

  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const chunksRef = useRef([]);
  const recognitionRef = useRef(null);

  const finalizedBlobRef = useRef(null);

  const finalTextRef = useRef("");
  const interimTextRef = useRef("");
  const isDictatingRef = useRef(false);

  const canUseSpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const patientId = useMemo(() => {
    return (
      selectedPatient?.idNumber ??
      selectedPatient?.id ??
      selectedPatient?.identifier ??
      null
    );
  }, [selectedPatient]);

  const patientLabel = useMemo(() => {
    if (!selectedPatient) return "No patient selected";
    const fn = selectedPatient.firstName || "";
    const ln = selectedPatient.lastName || "";
    const id = selectedPatient.idNumber || selectedPatient.id || "";
    return `${fn} ${ln}`.trim() + (id ? ` (ID ${id})` : "");
  }, [selectedPatient]);

  const storageKeyBase = useMemo(() => {
    return patientId ? `medicalcare_${patientId}` : "medicalcare_default";
  }, [patientId]);

  const draftTextKey = `${storageKeyBase}_draft_text`;
  const draftAudioKey = `${storageKeyBase}_draft_audio_dataurl`;
  const draftMimeKey = `${storageKeyBase}_draft_audio_mime`;

  useEffect(() => {
    isDictatingRef.current = isDictating;
  }, [isDictating]);

  const persistDraftText = (text) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(draftTextKey, text || "");
    } catch (error) {
      console.error(error);
    }
  };

  const persistDraftAudio = (dataUrl, mime) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(draftAudioKey, dataUrl || "");
      window.localStorage.setItem(draftMimeKey, mime || "");
    } catch (error) {
      console.error(error);
    }
  };

  const clearDraft = () => {
    setTranscription("");
    setAudioDataUrl("");
    setAudioMimeType("");
    setStatusMessage("");
    setIsAudioReady(false);

    finalTextRef.current = "";
    interimTextRef.current = "";
    finalizedBlobRef.current = null;

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(draftTextKey);
        window.localStorage.removeItem(draftAudioKey);
        window.localStorage.removeItem(draftMimeKey);
      } catch (error) {
        console.error(error);
      }
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const savedText = window.localStorage.getItem(draftTextKey) || "";
      const savedAudio = window.localStorage.getItem(draftAudioKey) || "";
      const savedMime = window.localStorage.getItem(draftMimeKey) || "";

      setTranscription(savedText);
      setAudioDataUrl(savedAudio);
      setAudioMimeType(savedMime);

      finalTextRef.current = savedText;
      interimTextRef.current = "";

      const ready =
        Boolean(savedAudio) &&
        !String(savedAudio).startsWith("blob:") &&
        String(savedAudio).length > 200;

      setIsAudioReady(ready);
    } catch (error) {
      console.error(error);
    }
  }, [draftTextKey, draftAudioKey, draftMimeKey]);

  useEffect(() => {
    if (!canUseSpeechRecognition) return;

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let newInterim = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const chunk = (result?.[0]?.transcript || "").trim();
        if (!chunk) continue;

        if (result.isFinal) {
          const base = finalTextRef.current || "";
          finalTextRef.current = (base ? `${base} ${chunk}` : chunk).trim();
        } else {
          newInterim = (newInterim ? `${newInterim} ${chunk}` : chunk).trim();
        }
      }

      interimTextRef.current = newInterim;

      const combined = `${finalTextRef.current}${
        newInterim ? ` ${newInterim}` : ""
      }`.trim();

      setTranscription(combined);
      persistDraftText(finalTextRef.current);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event?.error || event);
      setIsDictating(false);
      setStatusMessage("Dictation error.");
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch (error) {
        console.error(error);
      }
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canUseSpeechRecognition, draftTextKey]);

  useEffect(() => {
    return () => {
      try {
        if (
          mediaRecorderRef.current &&
          mediaRecorderRef.current.state !== "inactive"
        ) {
          mediaRecorderRef.current.stop();
        }
      } catch (error) {
        console.error(error);
      }

      try {
        if (mediaStreamRef.current) {
          mediaStreamRef.current.getTracks().forEach((t) => t.stop());
          mediaStreamRef.current = null;
        }
      } catch (error) {
        console.error(error);
      }

      try {
        recognitionRef.current?.stop();
      } catch (error) {
        console.error(error);
      }
    };
  }, []);

  const startRecording = async () => {
    if (!selectedPatient || isRecording) return;

    setIsAudioReady(false);
    finalizedBlobRef.current = null;
    setStatusMessage("Recording in progress...");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;

      const options = {};
      const mime = pickBestMimeType();
      if (mime) options.mimeType = mime;

      const recorder = new MediaRecorder(stream, options);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onerror = (event) => {
        console.error("Recorder error:", event);
        setStatusMessage("Recording error.");
      };

      recorder.onstop = async () => {
        try {
          const blob = new Blob(chunksRef.current, {
            type: recorder.mimeType || mime || "audio/webm",
          });

          finalizedBlobRef.current = blob;

          const dataUrl = await blobToDataUrl(blob);
          const blobMime = blob.type || recorder.mimeType || mime || "";

          setAudioDataUrl(dataUrl || "");
          setAudioMimeType(blobMime || "");
          persistDraftAudio(dataUrl || "", blobMime || "");

          const ready =
            Boolean(dataUrl) &&
            !String(dataUrl).startsWith("blob:") &&
            String(dataUrl).length > 200;

          setIsAudioReady(ready);
          setStatusMessage("Recording stopped.");
        } catch (error) {
          console.error("Finalize recording failed:", error);
          setStatusMessage("Failed to finalize recording.");
          setIsAudioReady(false);
        } finally {
          try {
            stream.getTracks().forEach((t) => t.stop());
          } catch (error) {
            console.error(error);
          }
          mediaStreamRef.current = null;
          setIsRecording(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error("Microphone error:", error);
      setStatusMessage("Microphone access failed.");
      alert("Could not access microphone. Please check permissions.");
      setIsRecording(false);
      setIsAudioReady(false);
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || !isRecording) return;
    try {
      mediaRecorderRef.current.stop();
    } catch (error) {
      console.error(error);
    }
    mediaRecorderRef.current = null;
  };

  const toggleDictation = () => {
    if (!selectedPatient || !canUseSpeechRecognition) return;

    if (isDictatingRef.current) {
      try {
        recognitionRef.current?.stop();
      } catch (error) {
        console.error(error);
      }

      interimTextRef.current = "";
      setIsDictating(false);

      const finalOnly = (finalTextRef.current || "").trim();
      setTranscription(finalOnly);
      persistDraftText(finalOnly);

      setStatusMessage("Dictation stopped.");
      return;
    }

    const currentFinal = (finalTextRef.current || "").trim();
    const currentUi = (transcription || "").trim();
    finalTextRef.current = currentFinal || currentUi;
    interimTextRef.current = "";

    try {
      recognitionRef.current?.start();
      setIsDictating(true);
      setStatusMessage("Dictation in progress...");
    } catch (error) {
      console.error("Dictation start failed:", error);
      setIsDictating(false);
      setStatusMessage("Failed to start dictation.");
    }
  };

  const handleImprove = async () => {
    if (!patientId) return;

    const base = (finalTextRef.current || transcription || "").trim();
    if (!base || isImproving) return;

    setIsImproving(true);
    setStatusMessage("Improving...");

    try {
      const improved = await improveRewrite({
        patientId,
        text: base,
        patient: selectedPatient,
      });

      const next = improved || base;

      finalTextRef.current = next;
      interimTextRef.current = "";

      setTranscription(next);
      persistDraftText(next);
      setStatusMessage("Text improved.");
    } catch (error) {
      console.error("Improve failed:", error);
      setStatusMessage("Improve failed.");
      alert("Improve failed. Please try again.");
    } finally {
      setIsImproving(false);
    }
  };

  const handleSave = async () => {
    if (!selectedPatient || typeof onSaveTranscription !== "function") return;

    if (isRecording) {
      alert("Recording is still in progress. Please stop recording first.");
      return;
    }

    const finalText = (finalTextRef.current || "").trim();
    const uiText = (transcription || "").trim();
    const text = finalText || uiText;

    const hasText = text.length > 0;
    const hasAudio = Boolean(audioDataUrl);

    if (!hasText && !hasAudio) {
      alert("Nothing to save. Please record audio or add transcription text.");
      return;
    }

    if (audioDataUrl && String(audioDataUrl).startsWith("blob:")) {
      alert("Audio is not ready yet. Please wait a moment and try again.");
      return;
    }

    if (hasAudio && !isAudioReady) {
      alert("Audio is not ready yet. Please wait a moment and try again.");
      return;
    }

    const entry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      type: "Transcription",
      title: "Treatment transcription",
      summary: text,
      date: new Date().toISOString(),
      audioUrl: audioDataUrl || "",
      audioData: audioDataUrl || "",
      audioMimeType: audioMimeType || "",
    };

    try {
      const arity = onSaveTranscription.length;

      if (arity <= 1) {
        await onSaveTranscription(entry);
      } else if (arity === 2) {
        await onSaveTranscription(entry.summary, entry.audioUrl || "");
      } else {
        await onSaveTranscription(patientId, entry.summary, entry.audioUrl || "");
      }

      if (patientId) {
        await syncLocalSessionsToMedplum(patientId, [
          {
            localSessionId: entry.id,
            createdAt: entry.date,
            transcriptionText: entry.summary,
            audioBlob: finalizedBlobRef.current || null,
            audioContentType: audioMimeType || "",
          },
        ]);
      }
    } catch (error) {
      console.error("onSaveTranscription failed", error);
      setStatusMessage("Save failed.");
      alert("Failed to save. Please try again.");
      return;
    }

    clearDraft();
    setStatusMessage("Saved.");
  };

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
          onClick={isRecording ? stopRecording : startRecording}
          disabled={!selectedPatient}
        >
          {isRecording ? "Stop recording" : "Start recording"}
        </button>

        <button
          type="button"
          className="record-btn record-btn-secondary"
          onClick={toggleDictation}
          disabled={!selectedPatient || !canUseSpeechRecognition}
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
          placeholder="Type or edit the session transcription here..."
          onChange={(event) => {
            const next = event.target.value;
            setTranscription(next);

            if (!isDictatingRef.current) {
              finalTextRef.current = next;
              interimTextRef.current = "";
              persistDraftText(next);
            }
          }}
        />

        <div className="record-footer-buttons">
          <button
            type="button"
            className="record-footer-btn record-save-btn"
            onClick={handleSave}
            disabled={isRecording || (!transcription.trim() && !isAudioReady)}
          >
            Save transcription
          </button>

          <button
            type="button"
            className="record-footer-btn record-ai-btn"
            onClick={handleImprove}
            disabled={
              isImproving ||
              !patientId ||
              !(finalTextRef.current || transcription).trim()
            }
          >
            {isImproving ? "Improving..." : "Improve with AI"}
          </button>

          <button
            type="button"
            className="record-footer-btn record-clear-btn"
            onClick={() => {
              clearDraft();
              setStatusMessage("Cleared.");
            }}
            disabled={!transcription && !audioDataUrl}
          >
            Clear
          </button>
        </div>
      </div>

      {audioDataUrl && !String(audioDataUrl).startsWith("blob:") ? (
        <div className="audio-preview">
          <audio controls preload="metadata">
            {audioMimeType ? (
              <source src={audioDataUrl} type={audioMimeType} />
            ) : (
              <source src={audioDataUrl} />
            )}
            Your browser does not support the audio element.
          </audio>
        </div>
      ) : null}

      <div className="record-status-line">
        {statusMessage ? statusMessage : ""}
      </div>
    </div>
  );
}

export default RecordAudio;
