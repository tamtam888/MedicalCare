import React, { useState, useRef, useEffect } from "react";
import "./RecordAudio.css";

function RecordAudio({ selectedPatient, onSaveTranscription }) {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState("");
  const [transcription, setTranscription] = useState("");
  const transcriptionIntervalRef = useRef(null);

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const fakeWords = [
    "The",
    "patient",
    "report",
    "indicates",
    "mild",
    "tension,",
    "voice",
    "fatigue,",
    "breathing",
    "improving.",
    "Continue",
    "hydration",
    "and",
    "daily",
    "exercises.",
    "Recommend",
    "follow-up.",
  ];

  const startFakeTranscription = () => {
    let index = 0;

    transcriptionIntervalRef.current = setInterval(() => {
      setTranscription((prev) => prev + " " + fakeWords[index]);
      index = (index + 1) % fakeWords.length;
    }, 800);
  };

  const stopFakeTranscription = () => {
    if (transcriptionIntervalRef.current) {
      clearInterval(transcriptionIntervalRef.current);
      transcriptionIntervalRef.current = null;
    }
  };

  const handleStart = async () => {
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

      setIsRecording(true);
      setTranscription("");
      startFakeTranscription();
    } catch (error) {
      console.error("Error accessing microphone:", error);
    }
  };

  const handleStop = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
    }

    stopFakeTranscription();
    setIsRecording(false);

    if (
      selectedPatient &&
      onSaveTranscription &&
      transcription &&
      transcription.trim()
    ) {
      onSaveTranscription(selectedPatient.idNumber, transcription);
    }
  };

  useEffect(() => {
    return () => {
      stopFakeTranscription();
    };
  }, []);

  return (
    <div className="record-audio-container">
      <h3>Record Audio</h3>

      {selectedPatient ? (
        <p className="recording-patient-label">
          Recording for: {selectedPatient.firstName}{" "}
          {selectedPatient.lastName} (ID {selectedPatient.idNumber})
        </p>
      ) : (
        <p className="recording-patient-label">
          Select a patient from the list to record a treatment.
        </p>
      )}

      {!isRecording && (
        <button
          className="btn-start"
          onClick={handleStart}
          disabled={!selectedPatient}
        >
          Start recording
        </button>
      )}

      {isRecording && (
        <button className="btn-stop" onClick={handleStop}>
          Stop recording
        </button>
      )}

     {(isRecording || transcription) && (
  <div className="live-transcription-box">
    <h4>{isRecording ? "Live transcription:" : "Final transcription:"}</h4>
    <div className="transcription-text">{transcription}</div>
  </div>
)}


      {audioURL && (
        <div className="audio-preview">
          <p>Preview:</p>
          <audio controls src={audioURL}></audio>
        </div>
      )}
    </div>
  );
}

export default RecordAudio;
