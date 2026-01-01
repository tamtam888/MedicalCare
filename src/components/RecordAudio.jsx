import React, { useState, useRef, useEffect, useMemo } from "react";
import "./RecordAudio.css";

function improveTranscription(text) {
  if (!text) return "";
  let result = text.trim().replace(/\s+/g, " ");
  if (!/[.!?]$/.test(result)) {
    result = `${result}.`;
  }
  return `Clinical summary: ${result.charAt(0).toUpperCase()}${result.slice(1)}`;
}

function base64ToBlob(base64, contentType) {
  const byteCharacters = atob(base64);
  const byteArrays = [];
  const sliceSize = 512;

  for (let offset = 0; offset < byteCharacters.length; offset += sliceSize) {
    const slice = byteCharacters.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);

    for (let i = 0; i < slice.length; i += 1) {
      byteNumbers[i] = slice.charCodeAt(i);
    }

    const byteArray = new Uint8Array(byteNumbers);
    byteArrays.push(byteArray);
  }

  return new Blob(byteArrays, { type: contentType });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result || "";
      const base64 = typeof result === "string" ? result.split(",")[1] : "";
      resolve(base64 || "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function blobToDataURL(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ""));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function RecordAudio({ selectedPatient, onSaveTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const [audioURL, setAudioURL] = useState("");
  const [audioBlob, setAudioBlob] = useState(null);
  const [audioDataURL, setAudioDataURL] = useState("");

  const [transcription, setTranscription] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

  const canUseSpeechRecognition =
    typeof window !== "undefined" &&
    (window.SpeechRecognition || window.webkitSpeechRecognition);

  const storageKeyBase = useMemo(() => {
    if (!selectedPatient) return "medicalcare_default";
    const id =
      selectedPatient.idNumber ||
      selectedPatient.id ||
      selectedPatient.identifier ||
      "patient";
    return `medicalcare_${id}`;
  }, [selectedPatient]);

  const audioStorageKey = `${storageKeyBase}_audio`;
  const transcriptionStorageKey = `${storageKeyBase}_transcription`;

  useEffect(() => {
    let urlToRevoke = "";

    try {
      if (typeof window === "undefined") return;

      const storedAudio = window.localStorage.getItem(audioStorageKey);
      const storedTranscription = window.localStorage.getItem(transcriptionStorageKey);

      if (storedAudio) {
        const blob = base64ToBlob(storedAudio, "audio/webm");
        const url = URL.createObjectURL(blob);
        urlToRevoke = url;

        setAudioBlob(blob);
        setAudioURL(url);
        setAudioDataURL(`data:audio/webm;base64,${storedAudio}`);
      } else {
        setAudioBlob(null);
        setAudioURL("");
        setAudioDataURL("");
      }

      setTranscription(storedTranscription || "");
    } catch (error) {
      console.error("Failed to restore recording from storage", error);
    }

    return () => {
      if (urlToRevoke) URL.revokeObjectURL(urlToRevoke);
    };
  }, [audioStorageKey, transcriptionStorageKey]);

  useEffect(() => {
    return () => {
      stopMediaRecorder();
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveAudioToStorage = async (blob) => {
    if (typeof window === "undefined") return;
    try {
      const base64 = await blobToBase64(blob);
      window.localStorage.setItem(audioStorageKey, base64);
    } catch (error) {
      console.error("Failed to save audio to storage", error);
    }
  };

  const saveTranscriptionToStorage = (text) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(transcriptionStorageKey, text || "");
    } catch (error) {
      console.error("Failed to save transcription to storage", error);
    }
  };

  const handleStartRecording = async () => {
    if (!selectedPatient || isRecording) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioChunksRef.current = [];

      let recorder;
      try {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      } catch {
        recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      }

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        audioChunksRef.current = [];

        const url = URL.createObjectURL(blob);
        const dataUrl = await blobToDataURL(blob);

        if (audioURL) {
          try {
            URL.revokeObjectURL(audioURL);
          } catch {}
        }

        setAudioBlob(blob);
        setAudioURL(url);
        setAudioDataURL(dataUrl);

        await saveAudioToStorage(blob);
        setStatusMessage("Recording saved locally.");
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      setStatusMessage("Recording in progress...");
    } catch (error) {
      console.error("Microphone error:", error);
      alert("Could not access microphone. Please check permissions.");
      setStatusMessage("Microphone access failed.");
    }
  };

  const stopMediaRecorder = () => {
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        console.error("Error stopping media recorder", error);
      }
      mediaRecorderRef.current = null;
    }
    setIsRecording(false);
  };

  const handleStopRecording = () => {
    stopMediaRecorder();
    setStatusMessage("Recording stopped.");
  };

  const handleToggleDictation = () => {
    if (!canUseSpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    if (isDictating) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
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
      let finalText = transcription || "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          finalText = `${finalText} ${transcript}`.trim();
        }
      }
      setTranscription(finalText);
      saveTranscriptionToStorage(finalText);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsDictating(false);
      setStatusMessage("Dictation error.");
    };

    recognition.onend = () => {
      setIsDictating(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsDictating(true);
    setStatusMessage("Dictation in progress...");
  };

  const handleImprove = () => {
    const text = transcription.trim();
    if (!text) return;

    const improved = improveTranscription(text);
    setTranscription(improved);
    saveTranscriptionToStorage(improved);
    setStatusMessage("Transcription improved.");
  };

  const handleClear = () => {
    setTranscription("");
    setAudioURL("");
    setAudioBlob(null);
    setAudioDataURL("");
    setStatusMessage("Recording and transcription cleared.");

    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem(audioStorageKey);
        window.localStorage.removeItem(transcriptionStorageKey);
      } catch (error) {
        console.error("Failed to clear storage", error);
      }
    }
  };

  const handleSave = async () => {
    if (!selectedPatient || !onSaveTranscription) return;

    const text = transcription.trim();
    const hasText = text.length > 0;

    let dataUrl = audioDataURL;
    if (!dataUrl && audioBlob) {
      try {
        dataUrl = await blobToDataURL(audioBlob);
        setAudioDataURL(dataUrl);
      } catch (e) {
        console.error("Failed to convert audio blob to data url", e);
      }
    }

    const hasAudio = Boolean(dataUrl);

    if (!hasText && !hasAudio) {
      alert("Nothing to save. Please record audio or add transcription text.");
      return;
    }

    onSaveTranscription(text, dataUrl);

    handleClear();
    setStatusMessage("Saved to patient history and cleared from editor.");
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
          className="record-btn record-btn-secondary"
          onClick={handleToggleDictation}
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
          onChange={(e) => {
            setTranscription(e.target.value);
            saveTranscriptionToStorage(e.target.value);
          }}
        />

        <div className="record-footer-buttons">
          <button type="button" className="record-footer-btn record-save-btn" onClick={handleSave}>
            Save transcription
          </button>

          <button
            type="button"
            className="record-footer-btn record-ai-btn"
            onClick={handleImprove}
            disabled={!transcription.trim()}
          >
            Improve with AI
          </button>

          <button
            type="button"
            className="record-footer-btn record-clear-btn"
            onClick={handleClear}
            disabled={!transcription && !audioURL}
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

      <div className="record-status-line">
        {canUseSpeechRecognition
          ? "Browser dictation is enabled."
          : "Speech recognition is not available in this browser."}
        {statusMessage && ` ${statusMessage}`}
      </div>
    </div>
  );
}

export default RecordAudio;
