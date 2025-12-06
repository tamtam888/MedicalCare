// src/components/RecordAudio.jsx
import React, { useState, useRef, useEffect } from "react";
import "./RecordAudio.css";

function RecordAudio({ selectedPatient, onSaveTranscription }) {
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isDictating, setIsDictating] = useState(false);

  const [audioURL, setAudioURL] = useState("");
  const [audioData, setAudioData] = useState(""); // data URL for saving
  const [transcription, setTranscription] = useState("");

  const [speechSupported, setSpeechSupported] = useState(true);
  const [language, setLanguage] = useState("en-US");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

  // Initialize speech recognition (dictation)
  useEffect(() => {
    if (typeof window === "undefined") {
      setSpeechSupported(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported.");
      setSpeechSupported(false);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let newText = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result[0] && result[0].transcript) {
          newText += result[0].transcript + " ";
        }
      }

      if (newText) {
        setTranscription((prev) => {
          const base = prev || "";
          const spacer = base && !base.endsWith(" ") ? " " : "";
          return `${base}${spacer}${newText.trim()}`;
        });
      }
    };

    recognition.onerror = (err) => {
      console.error("Speech recognition error:", err);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      try {
        recognitionRef.current?.stop();
      } catch {}
    };
  }, []);

  // When switching patient, reset transcription
  useEffect(() => {
    setTranscription("");
    setAudioURL("");
    setAudioData("");
  }, [selectedPatient?.idNumber]);

  // Audio recording start
  const handleStartAudio = async () => {
    if (!selectedPatient) {
      console.warn("No patient selected.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      audioChunksRef.current = [];
      const recorder = new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/mp3",
        });

        // URL for playback
        const localURL = URL.createObjectURL(audioBlob);
        setAudioURL(localURL);

        // Convert to base64 for saving in usePatients
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result; // data URL
          if (result) {
            setAudioData(result);
          }
        };
        reader.readAsDataURL(audioBlob);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  // Audio recording stop
  const handleStopAudio = () => {
    try {
      mediaRecorderRef.current?.stop();
    } catch {}
    mediaRecorderRef.current = null;
    setIsRecordingAudio(false);
  };

  // Start dictation
  const handleStartDictation = () => {
    if (!selectedPatient) return;
    if (!speechSupported) return;

    try {
      recognitionRef.current.lang = language;
      recognitionRef.current.start();
      setIsDictating(true);
    } catch (error) {
      console.error("Failed to start dictation:", error);
    }
  };

  // Stop dictation
  const handleStopDictation = () => {
    try {
      recognitionRef.current?.stop();
    } catch {}
    setIsDictating(false);
  };

  // Save transcription + audio
  const handleSaveClick = () => {
    if (!selectedPatient || typeof onSaveTranscription !== "function") {
      return;
    }

    const cleanText = (transcription || "").trim();
    const hasAudio = Boolean(audioData);

    if (!cleanText && !hasAudio) return;

    onSaveTranscription(
      selectedPatient.idNumber,
      cleanText,
      audioData // send audio to usePatients
    );

    // Reset UI
    setTranscription("");
    setAudioURL("");
    setAudioData("");
    setIsRecordingAudio(false);
    setIsDictating(false);
  };

  const fullName =
    selectedPatient
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

      {!speechSupported && (
        <p className="recording-warning">
          Speech-to-text not supported in this browser.
        </p>
      )}

      <div className="record-buttons-row">
        {!isRecordingAudio ? (
          <button
            className="btn-start"
            onClick={handleStartAudio}
            disabled={!selectedPatient}
          >
            Start audio recording
          </button>
        ) : (
          <button className="btn-stop" onClick={handleStopAudio}>
            Stop audio recording
          </button>
        )}

        {speechSupported && !isDictating && (
          <button
            className="btn-start"
            onClick={handleStartDictation}
            disabled={!selectedPatient}
          >
            Start dictation
          </button>
        )}

        {speechSupported && isDictating && (
          <button className="btn-stop" onClick={handleStopDictation}>
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
        <button
          className="btn-save-transcription"
          onClick={handleSaveClick}
          disabled={!selectedPatient}
        >
          Save transcription
        </button>
      </div>

      {audioURL && (
        <div className="audio-preview">
          <p>Audio preview:</p>
          <audio controls src={audioURL}></audio>
        </div>
      )}
    </div>
  );
}

export default RecordAudio;
