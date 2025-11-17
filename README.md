# MedicalCare - Client Side Treatment Management System

MedicalCare is a React based frontend application designed to help clinicians manage treatment sessions, transcriptions, care plans, reports and patient records.  
This project focuses entirely on the client side, with no backend required, making it ideal as an open source friendly and portfolio ready project.

The system is suitable for therapy, rehabilitation, voice care, sports medicine and general clinical environments.

---

## 🎯 Project Goals

- Provide an intuitive interface for documenting and managing treatment sessions.
- Enable real time or near real time transcription for clinical notes.
- Allow therapists to create structured care plans for each patient.
- Generate clear and professional treatment summary reports (PDF).
- Offer a personal treatment calendar for scheduling and reminders.
- Maintain a full digital patient record stored locally on the client.

---

## 🧩 Core Features (MVP)

### 1. Treatment Transcription

- Record audio from the device microphone.
- Perform basic transcription (using an API or a simulated placeholder for now).
- Display the transcription text on screen.
- Save the session notes to the patient record.

### 2. Care Plan Builder

- Add therapy goals.
- Add tasks, exercises or treatment steps.
- Plan treatment frequency and schedule.
- Save the care plan locally per patient.

### 3. Treatment Summary Report (PDF)

- Combine transcription and care plan into a single report.
- Generate and download a PDF document.
- Include date, patient details and summary notes.
- Store previous reports inside the patient record.

### 4. Treatment Calendar

- Add upcoming treatment sessions.
- Select dates and times through a calendar component.
- Store session schedule in localStorage.
- Display all future and past events in a clean interface.

### 5. Digital Patient Record

- Create and manage patient profiles.
- Store transcriptions, care plans and reports per patient.
- View and update existing records.
- No backend required (localStorage only).

---

## 🛠️ Tech Stack

- React (Hooks)
- JavaScript
- CSS
- Web Audio API
- LocalStorage
- jsPDF for PDF generation
- React Calendar or a similar calendar component

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
  index.js
