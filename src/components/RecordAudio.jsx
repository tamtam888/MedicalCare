// src/components/RecordAudio.jsx
import React, { useState, useRef, useEffect } from "react";
import "./RecordAudio.css";

function RecordAudio({ selectedPatient, onSaveTranscription }) {
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [transcription, setTranscription] = useState("");
  const [speechSupported, setSpeechSupported] = useState(true);
  const [language, setLanguage] = useState("en-US");

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recognitionRef = useRef(null);

  // Initialize speech recognition (once)
  useEffect(() => {
    if (typeof window === "undefined") {
      setSpeechSupported(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      console.warn("Speech recognition is not supported in this browser.");
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

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
    };

    recognitionRef.current = recognition;
    setSpeechSupported(true);

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error("Failed to stop speech recognition on cleanup:", error);
        }
        recognitionRef.current = null;
      }
    };
  }, []);

  // Load last transcription for selected patient
  // שינוי חשוב: התלות היא רק על idNumber, לא על כל האובייקט
  useEffect(() => {
    if (!selectedPatient || !Array.isArray(selectedPatient.history)) {
      setTranscription("");
      return;
    }

    const lastTranscription = [...selectedPatient.history]
      .reverse()
      .find((entry) => entry.type === "Transcription");

    if (lastTranscription && lastTranscription.summary) {
      setTranscription(lastTranscription.summary);
    } else {
      setTranscription("");
    }
  }, [selectedPatient?.idNumber]);

  // Audio recording handlers
  const handleStartAudio = async () => {
    if (!selectedPatient) {
      console.warn("No patient selected for recording.");
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
        const url = URL.createObjectURL(audioBlob);
        setAudioURL(url);
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecordingAudio(true);
    } catch (error) {
      console.error("Error accessing microphone for audio:", error);
    }
  };

  const handleStopAudio = () => {
    if (mediaRecorderRef.current) {
      try {
        mediaRecorderRef.current.stop();
      } catch (error) {
        console.error("Failed to stop media recorder:", error);
      }
      mediaRecorderRef.current = null;
    }
    setIsRecordingAudio(false);
  };

  // Dictation handlers (speech-to-text)
  const handleStartDictation = () => {
    if (!selectedPatient) {
      console.warn("No patient selected for dictation.");
      return;
    }

    if (!speechSupported || !recognitionRef.current) {
      console.warn("Speech recognition not supported.");
      return;
    }

    try {
      recognitionRef.current.lang = language;
      // Do not reset transcription here - we want to continue from existing text
      recognitionRef.current.start();
      setIsDictating(true);
    } catch (error) {
      console.error("Failed to start speech recognition:", error);
    }
  };

  const handleStopDictation = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (error) {
        console.error("Failed to stop speech recognition:", error);
      }
    }
    setIsDictating(false);
  };

  // Save transcription to patient history
  const handleSaveClick = () => {
    if (
      !selectedPatient ||
      !onSaveTranscription ||
      !transcription ||
      !transcription.trim()
    ) {
      return;
    }

    const clean = transcription.trim();

    // שולחים להוק את ה־idNumber והטקסט
    onSaveTranscription(selectedPatient.idNumber, clean);

    // אחרי שמירה - מנקים את הטקסט כדי שהשדה יהיה ריק
    setTranscription("");
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (error) {
          console.error("Failed to stop speech recognition on cleanup:", error);
        }
      }
      if (mediaRecorderRef.current) {
        try {
          mediaRecorderRef.current.stop();
        } catch (error) {
          console.error("Failed to stop media recorder on cleanup:", error);
        }
      }
    };
  }, []);

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
          Select a patient from the list to record a treatment.
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
          Speech-to-text is not supported in this browser. Audio will be
          recorded without live transcription.
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
            ? "Live transcription (you can edit):"
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
          disabled={!selectedPatient || !transcription.trim()}
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
