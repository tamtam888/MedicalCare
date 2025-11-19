<!-- .github/copilot-instructions.md - guidance for AI coding agents working on MedicalCare -->

# MedicalCare — Copilot Instructions

Purpose: give an AI coding agent the minimal, actionable context to be productive in this React + Vite client-only SPA.

- Quick start:
  - Install & run dev server: `npm install` then `npm run dev` (Vite dev server, default port 5173).
  - Build for production: `npm run build`; preview build: `npm run preview`.
  - Lint: `npm run lint`.

- Big picture (what this repo is):
  - Single-page React application (client-only). No backend or API integration in this repo — data is intended to live in-browser (localStorage).
  - Tech: React (Hooks), Vite (aliased to `rolldown-vite` in `package.json`), plain JavaScript/JSX, CSS.
  - Entry points: `src/main.jsx` -> mounts `App` (`src/App.jsx`). UI lives under `src/components/`.

- Core components & data flows to know (examples):
  - `src/App.jsx` holds the global `patients` state and exposes `handleCreatePatient` which is passed to `PatientForm`.
  - `src/components/PatientForm.jsx` is a controlled form that validates inputs and calls `onCreatePatient` with a patient object. IDs are generated with `crypto.randomUUID()`.
  - Typical flow: user fills `PatientForm` -> `onCreatePatient` invoked -> `App` updates `patients` state (currently in-memory).

- Project-specific conventions & patterns:
  - File extensions: components use `.jsx` for React components.
  - Module type: `package.json` uses `"type": "module"` — prefer ES module imports/exports.
  - Local persistence expectation: README documents storing data in `localStorage` and suggested hooks (`useLocalStorage.js`) — search/create `src/hooks/` if you implement persistence.
  - Use controlled inputs and small utility validation inside form components (see `PatientForm.jsx` validate() implementation).

- Tooling and gotchas:
  - `package.json` overrides `vite` to the `rolldown-vite` package. Use the provided `npm` scripts; avoid replacing Vite unless necessary.
  - No tests are present; do not assume a test runner. When adding tests, document test commands in this file.
  - ESLint is configured via `npm run lint` / `eslint .` — run lint before opening PRs.

- Integration points & future expectations (from README):
  - Audio / transcription: README mentions Web Audio API and external transcription; look for or add hooks under `src/hooks/useAudioRecorder.js`.
  - PDF generation: README references `jsPDF` / `pdfBuilder.js` — check `src/utils/` if implementing report export.

- How to change UI state or add features safely:
  - Prefer small, focused changes. To persist patients, add a `useLocalStorage` hook and replace the `useState([])` in `App.jsx` with that hook.
  - Keep `PatientForm` behavior: controlled inputs, same validation shape, and `onCreatePatient` contract (object with `firstName`, `lastName`, `dateOfBirth`, optional fields).

- PR guidance for AI agents:
  - Run `npm run lint` and `npm run dev` to verify changes locally.
  - Do not introduce backend services or secrets in the repo — this is a client-only app.
  - Keep changes in `src/` and update README if new public behavior or top-level scripts are added.

- Where to look first when asked to implement features:
  - UI form changes: `src/components/PatientForm.jsx`.
  - App-level state: `src/App.jsx`.
  - Mounting and styles: `src/main.jsx`, `src/index.css`, `src/App.css`.

If anything important is missing from this file (deploy steps, CI, or coding conventions), please ask the maintainer to add it to the README or provide examples in the repo so this guidance can be updated.

-- End of file
