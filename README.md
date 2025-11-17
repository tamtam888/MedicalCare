# VocalCare - Voice Health Tracker (Frontend Only)

VocalCare is a React based web application that helps users track their voice health over time.  
The app focuses on frontend only (no backend) and is built as a portfolio friendly, open source project.

The main idea:  
Simple interface for recording short voice samples, analyzing basic parameters in the browser, and showing trends and tips that can help protect and improve vocal health.

---

## 🎯 Goals

- Provide a clean and simple UI for monitoring voice condition over time.
- Use modern browser APIs (Web Audio) with React and JavaScript.
- Demonstrate real world frontend skills: state management, charts, local storage, accessibility and UI/UX.
- Serve as a solid open source project and portfolio piece.

---

## 🧩 Tech Stack

- **React** (Hooks)
- **JavaScript (ES6+)**
- **Web Audio API** (basic analysis in the browser)
- **LocalStorage** for client side persistence
- **Chart library** (Recharts or Chart.js)
- **CSS / CSS Modules / styled-components** (choose one and keep it consistent)
- **Build tool**: Vite or Create React App (depending on setup)

> Note: This project is frontend only. No backend or database is required.

---

## 🗂 Project Structure (example)

```text
src/
  components/
    RecordPanel/
    HistoryList/
    VoiceChart/
    TipsPanel/
    PdfExportButton/
  hooks/
    useAudioRecorder.js
    useLocalStorage.js
  utils/
    voiceAnalysis.js
    formatDate.js
  App.jsx
  main.jsx (or index.js)

