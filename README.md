# MedicalCare - Client Side Treatment Management System

MedicalCare is a modern React based client side application designed to support clinicians in managing patients, treatment sessions, transcription, clinical documentation and future care planning.

The system is part of a larger professional project workflow, managed through Trello and Git branching strategy.  
This README describes the MVP, core features and development flow without tying the project to specific filenames, so the structure can evolve freely during development.

---

## 🎯 MVP Scope (Based on Trello)

The MVP focuses on the essential clinical workflow:  
patient creation, documentation, transcription and report attachments.

### 1. Digital Patient Record (Core)

- Create and manage patient profiles.
- Validate required fields (ID number, phone, date of birth).
- Block invalid or duplicate ID numbers.
- Store patient data locally so the records persist after refresh.
- Maintain structured patient information:
  - Demographics and contact details
  - Notes
  - Treatment history
  - Attached reports

This is the foundation of the entire system.

---

### 2. Treatment Transcription - Audio Recording

- Record audio using the browser's microphone.
- Show recording controls (start, stop, reset).
- Provide basic or mock transcription.
- Allow the clinician to add transcriptions to the patient’s treatment history.
- Prepare groundwork for advanced speech-to-text API integration.

---

### 3. Attach Clinical Reports

- Upload and attach documents to a selected patient (PDF, images or other files).
- Store metadata for each attached report.
- Display attached documents inside the patient record.
- Enable clinicians to quickly review previous materials.

---

### 4. Treatment History View

- Display chronological treatment sessions for each patient.
- Include:
  - Transcriptions
  - Notes
  - Attached reports
- Prepare the UI for future advanced modules (care plan, treatment calendar).

---

## 🔮 Next Planned Features (After MVP)

These features are defined in Trello and will be implemented in separate feature branches after the MVP is complete.

### Care Plan Builder

- Create therapy goals per patient.
- Add structured exercises, steps and instructions.
- Define frequency and expected progress.
- Integrate the plan into the patient’s history.

### Treatment Calendar

- Schedule upcoming treatments.
- Choose dates and times from a calendar UI.
- Store future appointments locally.
- Allow clinicians to track upcoming and past sessions.

### PDF Treatment Summary

- Combine:
  - Patient details
  - Selected treatment history entries
  - Care plan items
- Generate a professional PDF treatment report.
- Allow download, email or attaching the PDF to the patient record.

---

## 🛠️ Technology

- React (Vite)
- JavaScript (ES6+)
- CSS (per component styling)
- LocalStorage (persistent client side data)
- Web Audio API (microphone recording)
- Planned:
  - jsPDF for PDF export
  - Calendar UI library for scheduling
  - Optional integrations with external clinical APIs in the future

---

## 📁 Project Structure Philosophy

The project follows a simple and scalable structure:

- **Components**: each feature is built as a separate reusable component.
- **CSS per component**: clean visual separation.
- **LocalStorage**: used as the local data layer.
- **Trello**: tracks all user stories and development tasks.
- **Feature branches**: isolate work without breaking main.

No file names are included in this README to keep development flexible.

---

## 🌐 Development Flow (Trello + Git)

1. Choose a Trello user story (MVP or planned).
2. Create or switch to the appropriate `feature/...` branch.
3. Build or refine the component for that feature.
4. Add validation, accessibility, logic and UI.
5. Test the feature locally (including page refresh and localStorage behavior).
6. Update Trello status (In Progress → Review → Done).
7. Merge the feature back into `main` when stable.

This keeps the project clean, structured and professional.

---

## 💾 Data Persistence

- All patient data is stored on the client only.
- Records persist after refresh.
- Storage is normalized so:
  - `history` exists for every patient,
  - `reports` exists for every patient.
- No backend or server needed for the MVP.

---

## 🚀 How to Run Locally

```bash
git clone <your-repo-url>
cd MedicalCare
npm install
npm run dev

