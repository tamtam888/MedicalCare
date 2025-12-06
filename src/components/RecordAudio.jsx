// src/components/RecordAudio.jsx
import { useState, useRef, useEffect } from "react";
import "./RecordAudio.css";
import { IMPROVE_API_URL } from "../constants";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

function RecordAudio({ selectedPatient, onSaveTranscription }) {
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const [audioURL, setAudioURL] = useState("");
  const [audioData, setAudioData] = useState("");
  const [transcription, setTranscription] = useState("");

  const [speechSupported, setSpeechSupported] = useState(true);
  const [language, setLanguage] = useState("en-US");
  const [permissionWarning, setPermissionWarning] = useState("");
  const [micPermissionStatus, setMicPermissionStatus] = useState("prompt"); // "granted", "denied", "prompt"
  const [useLibrary, setUseLibrary] = useState(true); // Use react-speech-recognition library

  const {
    interimTranscript,
    finalTranscript,
    listening,
    browserSupportsSpeechRecognition,
    resetTranscript,
  } = useSpeechRecognition();

  // Check microphone permission status
  useEffect(() => {
    const checkMicrophonePermission = async () => {
      if (typeof window === "undefined" || !navigator.permissions) {
        return;
      }

      try {
        const result = await navigator.permissions.query({ name: "microphone" });
        setMicPermissionStatus(result.state);

        result.onchange = () => {
          setMicPermissionStatus(result.state);
        };

        if (result.state === "denied") {
          setPermissionWarning(
            "⚠️ Microphone access is blocked. Please allow microphone access in your browser settings."
          );
        } else if (result.state === "prompt") {
          setPermissionWarning(
            "ℹ️ Click 'Start audio recording' or 'Start dictation' to allow microphone access."
          );
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.log("[RecordAudio] Permissions API not supported:", error);
        }
      }
    };

    checkMicrophonePermission();
  }, []);

  // Check if running on HTTPS or localhost (required for microphone)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const isSecure =
        window.location.protocol === "https:" ||
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1";

      if (!isSecure && import.meta.env.DEV) {
        console.warn(
          "[RecordAudio] Running on HTTP. Microphone access requires HTTPS or localhost."
        );
        setPermissionWarning(
          "⚠️ Microphone access requires HTTPS. For development, use localhost or enable HTTPS."
        );
      }
    }
  }, []);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);
  const isDictatingRef = useRef(false);
  const lastFinalIndexRef = useRef(-1);
  const finalTranscriptRef = useRef("");

  const resetDraft = () => {
    setTranscription("");
    setAudioURL("");
    setAudioData("");
    setIsRecordingAudio(false);
    setIsDictating(false);
    lastFinalIndexRef.current = -1;
    finalTranscriptRef.current = "";

    if (useLibrary && browserSupportsSpeechRecognition) {
      try {
        SpeechRecognition.stopListening();
        resetTranscript();
      } catch {
        // ignore
      }
    } else if (recognitionRef.current && isDictatingRef.current) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
    }
    isDictatingRef.current = false;
  };

  // Update transcription when library transcript changes, only while listening
  useEffect(() => {
    if (!useLibrary || !browserSupportsSpeechRecognition) return;
    if (!listening) return;

    const fullText =
      finalTranscript + (interimTranscript ? " " + interimTranscript : "");

    setTranscription(fullText);
    setIsDictating(true);
    isDictatingRef.current = true;
  }, [
    finalTranscript,
    interimTranscript,
    listening,
    useLibrary,
    browserSupportsSpeechRecognition,
  ]);

  // Check if browser supports speech recognition
  useEffect(() => {
    if (!browserSupportsSpeechRecognition) {
      setSpeechSupported(false);
      setUseLibrary(false);
    } else {
      setSpeechSupported(true);
    }
  }, [browserSupportsSpeechRecognition]);

  // Speech recognition init (fallback to native API if library not available)
  useEffect(() => {
    if (useLibrary && browserSupportsSpeechRecognition) {
      return;
    }

    if (typeof window === "undefined") {
      setSpeechSupported(false);
      return;
    }

    const SpeechRecognitionNative =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognitionNative) {
      if (import.meta.env.DEV) {
        console.warn("Speech recognition is not supported.");
      }
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognitionNative();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let newFinalText = "";
      let latestInterimText = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result && result.length > 0 && result[0] && result[0].transcript) {
          const piece = result[0].transcript.trim();

          if (result.isFinal) {
            if (i > lastFinalIndexRef.current) {
              newFinalText += piece + " ";
              lastFinalIndexRef.current = i;
            }
          } else {
            latestInterimText = piece;
          }
        }
      }

      if (newFinalText.trim()) {
        finalTranscriptRef.current +=
          (finalTranscriptRef.current ? " " : "") + newFinalText.trim();
        setTranscription(
          finalTranscriptRef.current +
            (latestInterimText ? " " + latestInterimText : "")
        );
      } else if (latestInterimText) {
        setTranscription(
          finalTranscriptRef.current +
            (finalTranscriptRef.current ? " " : "") +
            latestInterimText
        );
      }
    };

    recognition.onerror = (err) => {
      console.error("[RecordAudio] Speech recognition error:", err);

      if (err.error === "not-allowed") {
        alert(
          "Microphone access denied for speech recognition.\n\n" +
            "Please allow microphone access:\n" +
            "1. Click the lock icon (🔒) in your browser's address bar\n" +
            "2. Find 'Microphone' and set it to 'Allow'\n" +
            "3. Refresh the page and try again"
        );
        isDictatingRef.current = false;
        setIsDictating(false);
      } else if (err.error === "no-speech") {
        if (import.meta.env.DEV) {
          console.log("[RecordAudio] No speech detected (this is normal)");
        }
      } else if (err.error === "audio-capture") {
        alert(
          "Could not access microphone for speech recognition. Please check your microphone settings."
        );
        isDictatingRef.current = false;
        setIsDictating(false);
      } else if (err.error === "network") {
        alert(
          "Network error in speech recognition. Please check your internet connection."
        );
        isDictatingRef.current = false;
        setIsDictating(false);
      } else {
        if (import.meta.env.DEV) {
          console.warn(
            `[RecordAudio] Speech recognition error: ${err.error}`
          );
        }
      }
    };

    recognition.onend = () => {
      if (isDictatingRef.current && recognitionRef.current) {
        try {
          recognitionRef.current.start();
        } catch (error) {
          if (import.meta.env.DEV) {
            console.warn("Failed to restart recognition:", error);
          }
          isDictatingRef.current = false;
          setIsDictating(false);
        }
      }
    };

    recognition.onstart = () => {
      if (import.meta.env.DEV) {
        console.log("Speech recognition started");
      }
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Error cleaning up speech recognition:", error);
        }
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset draft when switching patient
  useEffect(() => {
    resetDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPatient?.idNumber]);

  const handleStartAudio = async () => {
    if (!selectedPatient) {
      alert("Please select a patient first.");
      return;
    }

    if (!window.MediaRecorder) {
      alert(
        "Audio recording is not supported in this browser. Please use a modern browser like Chrome, Edge, or Firefox."
      );
      return;
    }

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert(
        "Microphone access is not available. Please ensure:\n" +
          "1. You are using HTTPS or localhost\n" +
          "2. Your browser supports microphone access\n" +
          "3. Try refreshing the page"
      );
      return;
    }

    try {
      if (import.meta.env.DEV) {
        console.log("[RecordAudio] Requesting microphone access...");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      if (import.meta.env.DEV) {
        console.log("[RecordAudio] Microphone access granted");
      }

      audioChunksRef.current = [];

      let mimeType = "audio/webm";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "";
      }

      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined
      );

      recorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        try {
          await new Promise((resolve) => setTimeout(resolve, 100));

          const blobType =
            recorder.mimeType ||
            mediaRecorderRef.current?.mimeType ||
            "audio/webm";

          if (audioChunksRef.current.length === 0) {
            console.warn("[RecordAudio] No audio chunks collected");
            setIsRecordingAudio(false);
            try {
              stream.getTracks().forEach((track) => track.stop());
            } catch {
              // ignore
            }
            return;
          }

          const audioBlob = new Blob(audioChunksRef.current, {
            type: blobType,
          });

          if (audioBlob.size === 0) {
            console.warn("[RecordAudio] Recorded audio blob is empty");
            setIsRecordingAudio(false);
            try {
              stream.getTracks().forEach((track) => track.stop());
            } catch {
              // ignore
            }
            return;
          }

          if (import.meta.env.DEV) {
            console.log(
              `[RecordAudio] Audio recorded: ${audioBlob.size} bytes, type: ${blobType}`
            );
          }

          const localURL = URL.createObjectURL(audioBlob);
          setAudioURL(localURL);

          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result;
            if (result && typeof result === "string") {
              let dataUrl = result;
              if (!dataUrl.startsWith("data:")) {
                dataUrl = `data:${blobType};base64,${result}`;
              }
              setAudioData(dataUrl);
              if (import.meta.env.DEV) {
                console.log(
                  `[RecordAudio] Audio converted to base64 data URL: ${dataUrl.length} characters`
                );
              }
            } else {
              console.error(
                "[RecordAudio] Failed to convert audio to base64 - result is not a string"
              );
              setIsRecordingAudio(false);
            }
          };
          reader.onerror = (error) => {
            console.error("[RecordAudio] Failed to read audio file:", error);
            setIsRecordingAudio(false);
          };
          reader.readAsDataURL(audioBlob);

          try {
            stream.getTracks().forEach((track) => {
              track.stop();
              if (import.meta.env.DEV) {
                console.log("[RecordAudio] Stopped media track");
              }
            });
          } catch (error) {
            if (import.meta.env.DEV) {
              console.warn(
                "[RecordAudio] Failed to stop stream tracks:",
                error
              );
            }
          }
        } catch (error) {
          console.error("[RecordAudio] Error in onstop handler:", error);
          setIsRecordingAudio(false);
        }
      };

      recorder.onerror = (event) => {
        console.error("MediaRecorder error:", event.error);
        setIsRecordingAudio(false);
        alert("An error occurred while recording audio.");
        try {
          stream.getTracks().forEach((track) => track.stop());
        } catch {
          // ignore
        }
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
    } catch (error) {
      console.error("[RecordAudio] Error accessing microphone:", error);
      let errorMessage = "Could not access microphone.";
      let detailedMessage = "";

      if (
        error.name === "NotAllowedError" ||
        error.name === "PermissionDeniedError"
      ) {
        errorMessage = "Microphone access denied";
        setMicPermissionStatus("denied");
        detailedMessage =
          "Please allow microphone access:\n\n" +
          "For Chrome/Edge:\n" +
          "1. Click the lock icon (🔒) or camera icon (📷) in your browser's address bar\n" +
          "2. Find 'Microphone' in the permissions list\n" +
          "3. Change it to 'Allow'\n" +
          "4. Refresh the page and try again\n\n" +
          "Alternative: Go to Settings → Privacy and security → Site settings → Microphone\n" +
          "Find 'localhost' and set it to 'Allow'";
      } else if (
        error.name === "NotFoundError" ||
        error.name === "DevicesNotFoundError"
      ) {
        errorMessage = "No microphone found";
        detailedMessage =
          "Please connect a microphone to your computer and try again.";
      } else if (
        error.name === "NotReadableError" ||
        error.name === "TrackStartError"
      ) {
        errorMessage = "Microphone is being used by another application";
        detailedMessage =
          "Please close other applications using the microphone and try again.";
      } else if (error.name === "OverconstrainedError") {
        errorMessage = "Microphone settings not supported";
        detailedMessage =
          "Your microphone does not support the requested settings. Please try with a different microphone or browser.";
      } else {
        detailedMessage = `Error: ${error.message || error.name}`;
      }

      alert(`${errorMessage}\n\n${detailedMessage}`);
      setIsRecordingAudio(false);
    }
  };

  const handleStopAudio = () => {
    try {
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn("Error stopping audio recording:", error);
      }
    } finally {
      mediaRecorderRef.current = null;
      setIsRecordingAudio(false);
    }
  };

  const handleStartDictation = async () => {
    if (!selectedPatient) {
      alert("Please select a patient first.");
      return;
    }
    if (!speechSupported) {
      alert(
        "Speech recognition is not supported in this browser.\n\n" +
          "Speech-to-text works best in:\n" +
          "- Chrome or Edge (recommended)\n" +
          "- Safari on macOS or iOS\n\n" +
          "Please use one of these browsers for dictation."
      );
      return;
    }

    // Ask for microphone permission first
    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        if (import.meta.env.DEV) {
          console.log(
            "[RecordAudio] Requesting microphone for speech recognition..."
          );
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
        if (import.meta.env.DEV) {
          console.log(
            "[RecordAudio] Microphone permission granted for speech recognition"
          );
        }
      }
    } catch (micError) {
      console.error(
        "[RecordAudio] Microphone permission denied for speech recognition:",
        micError
      );
      let micMessage =
        "Microphone access is required for speech recognition.";
      if (
        micError.name === "NotAllowedError" ||
        micError.name === "PermissionDeniedError"
      ) {
        micMessage =
          "Microphone access denied.\n\n" +
          "Please allow microphone access:\n" +
          "1. Click the lock icon (🔒) in your browser's address bar\n" +
          "2. Find 'Microphone' and set it to 'Allow'\n" +
          "3. Refresh the page and try again";
      }
      alert(micMessage);
      return;
    }

    // Preferred path: use library
    if (useLibrary && browserSupportsSpeechRecognition) {
      try {
        resetTranscript();
        SpeechRecognition.startListening({
          continuous: true,
          language,
        });
        isDictatingRef.current = true;
        setIsDictating(true);

        if (import.meta.env.DEV) {
          console.log(
            `[RecordAudio] Speech recognition started via library (language: ${language})`
          );
        }
      } catch (error) {
        console.error(
          "[RecordAudio] Failed to start dictation with library:",
          error
        );
        let errorMsg = "Failed to start dictation.";
        if (error.message && error.message.includes("already started")) {
          errorMsg =
            "Dictation is already running. Please stop it first.";
        } else if (error.message && error.message.includes("not allowed")) {
          errorMsg =
            "Microphone access denied for speech recognition.\n\n" +
            "Please allow microphone access in your browser settings.";
        } else {
          errorMsg = `Failed to start dictation: ${
            error.message || error.name
          }`;
        }
        alert(errorMsg);
        isDictatingRef.current = false;
        setIsDictating(false);
      }
      return;
    }

    // Fallback to native API
    try {
      if (!recognitionRef.current) {
        alert(
          "Speech recognition is not available in this browser. Please try Chrome, Edge, or Safari."
        );
        return;
      }

      recognitionRef.current.lang = language;
      finalTranscriptRef.current = "";
      lastFinalIndexRef.current = -1;
      setTranscription("");
      recognitionRef.current.start();
      isDictatingRef.current = true;
      setIsDictating(true);

      if (import.meta.env.DEV) {
        console.log(
          `[RecordAudio] Speech recognition started (native API, language: ${language})`
        );
      }
    } catch (error) {
      console.error("[RecordAudio] Failed to start dictation:", error);
      let errorMsg = "Failed to start dictation.";
      if (error.message && error.message.includes("already started")) {
        errorMsg = "Dictation is already running. Please stop it first.";
      } else if (error.message && error.message.includes("not allowed")) {
        errorMsg =
          "Microphone access denied for speech recognition.\n\n" +
          "Please allow microphone access in your browser settings.";
      } else {
        errorMsg = `Failed to start dictation: ${
          error.message || error.name
        }`;
      }

      alert(errorMsg);
      isDictatingRef.current = false;
      setIsDictating(false);
    }
  };

  const handleStopDictation = () => {
    if (useLibrary && browserSupportsSpeechRecognition) {
      try {
        SpeechRecognition.stopListening();
        if (import.meta.env.DEV) {
          console.log("[RecordAudio] Stopped dictation using library");
        }
        setIsDictating(false);
        isDictatingRef.current = false;
      } catch (error) {
        console.error(
          "[RecordAudio] Error stopping dictation with library:",
          error
        );
        setIsDictating(false);
        isDictatingRef.current = false;
      }
    } else {
      isDictatingRef.current = false;
      setIsDictating(false);
      try {
        if (recognitionRef.current) {
          recognitionRef.current.stop();
        }
        if (import.meta.env.DEV) {
          console.log("[RecordAudio] Stopped dictation (native API)");
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn("Error stopping dictation:", error);
        }
      }
    }
  };

  const handleSaveClick = () => {
    if (!selectedPatient || typeof onSaveTranscription !== "function") {
      if (import.meta.env.DEV) {
        console.warn(
          "[RecordAudio] Cannot save: missing patient or callback"
        );
      }
      return;
    }

    const cleanText = (transcription || "").trim();
    const hasAudio = Boolean(audioData);

    if (!cleanText && !hasAudio) {
      alert(
        "Please record audio or enter transcription text before saving."
      );
      return;
    }

    if (import.meta.env.DEV) {
      console.log(
        `[RecordAudio] Saving transcription: text=${cleanText.length} chars, audio=${hasAudio}`
      );
    }

    try {
      onSaveTranscription(selectedPatient.idNumber, cleanText, audioData);
      resetDraft();
      alert("Transcription saved successfully!");
    } catch (error) {
      console.error("[RecordAudio] Failed to save transcription:", error);
      alert("Failed to save transcription. Please try again.");
    }
  };

  const handleImproveWithAi = async () => {
    const cleanText = (transcription || "").trim();
    if (!cleanText) return;

    try {
      const response = await fetch(IMPROVE_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: cleanText,
          language,
          patientId: selectedPatient?.idNumber || null,
        }),
      });

      if (!response.ok) {
        throw new Error("AI improve API failed");
      }

      const data = await response.json();
      const improved = (data.improvedText || "").trim();

      if (improved) {
        setTranscription(improved);
      }
    } catch (error) {
      console.error("Failed to improve note with AI", error);
      alert("AI note improvement is not available right now.");
    }
  };

  const isActiveRecording = isRecordingAudio || isDictating;

  const fullName = selectedPatient
    ? [selectedPatient.firstName, selectedPatient.lastName]
        .filter(Boolean)
        .join(" ")
    : "";

  return (
    <div className="record-audio-container">
      <h3>Record Audio and Transcription</h3>

      {selectedPatient ? (
        <p className="recording-patient-label">
          Recording for: {fullName} (ID {selectedPatient.idNumber})
        </p>
      ) : (
        <p className="recording-patient-label">
          Select a patient to begin recording or dictation.
        </p>
      )}

      {speechSupported && (
        <div className="recording-language">
          <label>
            Language:&nbsp;
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              <option value="en-US">English</option>
              <option value="he-IL">עברית</option>
            </select>
          </label>
        </div>
      )}

      {permissionWarning && (
        <div
          className="recording-warning"
          style={{
            padding: "0.75rem",
            backgroundColor:
              micPermissionStatus === "denied" ? "#fee2e2" : "#fef3c7",
            border: `1px solid ${
              micPermissionStatus === "denied" ? "#dc2626" : "#f59e0b"
            }`,
            borderRadius: "8px",
            marginBottom: "1rem",
            color: micPermissionStatus === "denied" ? "#991b1b" : "#92400e",
          }}
        >
          {permissionWarning}
          {micPermissionStatus === "denied" && (
            <div style={{ marginTop: "0.5rem", fontSize: "0.875rem" }}>
              <strong>Quick fix:</strong> Click the lock icon (🔒) in the
              address bar → Microphone → Allow
            </div>
          )}
        </div>
      )}

      {!speechSupported && (
        <p className="recording-warning">
          Speech-to-text is not supported in this browser. Please use Chrome,
          Edge, or Safari.
        </p>
      )}

      {isActiveRecording && (
        <div className="recording-indicator-row">
          <div className="recording-mic-icon">🎤</div>
          <div className="recording-eq">
            <span className="eq-bar eq-bar-1" />
            <span className="eq-bar eq-bar-2" />
            <span className="eq-bar eq-bar-3" />
            <span className="eq-bar eq-bar-4" />
          </div>
          <span className="recording-status-text">Listening...</span>
        </div>
      )}

      <div className="record-buttons-row">
        {!isRecordingAudio ? (
          <button
            type="button"
            className="btn-start"
            onClick={handleStartAudio}
            disabled={!selectedPatient}
          >
            Start audio recording
          </button>
        ) : (
          <button
            type="button"
            className="btn-stop"
            onClick={handleStopAudio}
          >
            Stop audio recording
          </button>
        )}

        {speechSupported && !isDictating && (
          <button
            type="button"
            className="btn-start"
            onClick={handleStartDictation}
            disabled={!selectedPatient}
          >
            Start dictation
          </button>
        )}

        {speechSupported && isDictating && (
          <button
            type="button"
            className="btn-stop"
            onClick={handleStopDictation}
          >
            Stop dictation
          </button>
        )}
      </div>

      <div className="live-transcription-box">
        <h4>
          {isDictating
            ? "Live transcription (editable):"
            : "Transcription (editable):"}
        </h4>
        <textarea
          className="transcription-textarea"
          value={transcription}
          onChange={(e) => setTranscription(e.target.value)}
          rows={6}
        />

        <div className="transcription-buttons-row">
          <button
            type="button"
            className="btn-save-transcription"
            onClick={handleSaveClick}
            disabled={!selectedPatient}
          >
            📝 Save transcription
          </button>

          <button
            type="button"
            className="btn-ai-improve"
            onClick={handleImproveWithAi}
            disabled={!transcription.trim()}
          >
            ✨ Improve with AI
          </button>

          <button
            type="button"
            className="btn-clear-transcription"
            onClick={resetDraft}
          >
            Clear
          </button>
        </div>
      </div>

      {audioURL && (
        <div className="audio-preview">
          <p>Audio preview:</p>
          <audio
            controls
            src={audioURL}
            onError={() => {
              console.error("Failed to load audio preview");
              setAudioURL("");
            }}
          />
        </div>
      )}
    </div>
  );
}

export default RecordAudio;

/*
 * FILE DOCUMENTATION: src/components/RecordAudio.jsx
 *
 * Component for audio recording and speech-to-text transcription.
 * Uses react-speech-recognition when available and falls back
 * to the native Web Speech API otherwise.
 */
