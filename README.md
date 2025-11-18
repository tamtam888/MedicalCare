# MedicalCare - Client Side Treatment Management System

MedicalCare is a React based frontend application designed to help clinicians manage treatment sessions, transcriptions, care plans, reports and patient records.  
This project focuses entirely on the client side (no backend), making it ideal as a portfolio project and suitable for open source integration in the future.

The system supports therapy, rehabilitation, sports medicine, voice care and general clinical documentation workflows.

---

## 🎯 Project Goals

- Provide an intuitive interface for documenting and managing treatment sessions.
- Enable real time or near real time transcription for clinical notes.
- Allow therapists to create structured care plans for each patient.
- Generate clear and professional treatment summary reports (PDF).
- Provide a built in treatment calendar for scheduling and reminders.
- Maintain a full digital patient record, stored locally on the client.

---

## 🧩 Core Features (MVP)

### 1. Treatment Transcription

- Record audio from the device microphone.
- Perform simple transcription (placeholder or external API).
- Display transcription live on the screen.
- Save session notes to the patient record.

---

### 2. Care Plan Builder

- Add therapy goals.
- Add exercises, tasks or treatment steps.
- Select treatment frequency and schedule.
- Save the care plan for each patient.

---

### 3. Treatment Summary Report (PDF)

- Combine transcription + care plan into a single PDF.
- Include patient details, notes and structured sections.
- Generate and download the report.
- Save previous reports inside the patient’s digital record.

---

### 4. Treatment Calendar

- Add future treatment sessions.
- Choose dates and times using a calendar component.
- Store the schedule in localStorage.
- Display upcoming and past appointments in a clean interface.

---

### 5. Digital Patient Record

- Create and manage patient profiles.
- View past sessions, care plans and reports.
- Store all data locally (localStorage only).
- Update or delete patient information when needed.

---

## 🛠️ Tech Stack

- React (Hooks)
- JavaScript (ES6+)
- CSS
- Web Audio API
- LocalStorage
- jsPDF (for PDF generation)
- React Calendar or similar calendar library

---

## 📁 Suggested Project Structure

```text
src/
  components/
    Transcription/
    CarePlan/
    PatientCard/
    CalendarView/
    ReportGenerator/
  hooks/
    useAudioRecorder.js
    useLocalStorage.js
  utils/
    transcriptionMock.js
    pdfBuilder.js
    dateUtils.js
  data/
    mockPatients.json
  App.jsx
  main.jsx
