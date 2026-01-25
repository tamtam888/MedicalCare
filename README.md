# MedicalCare — Clinic Management (React + Vite)

MedicalCare is a React (Vite) client application for managing patients and treatment workflow, including an appointments calendar, in-app notifications, and optional Medplum synchronization.

> Repository note: the `main-clean` branch may be protected and require Pull Requests for changes (no direct push).

---

## ✅ Implemented Features

### Patient Management
- Create and manage patient profiles.
- Persist patient data in browser storage so it survives refresh.
- Patient details page with history and supporting UI modules.

### Appointments Calendar (Treatments)
- Weekly/day/month views using FullCalendar.
- Create appointments via selection or “+ Add”.
- Edit appointments in a drawer.
- Drag & drop / resize appointments.
- Clinic-hours enforcement (07:00–22:00).
- Conflict prevention:
  - Prevent double-booking for the same therapist.
  - Prevent a patient being booked with two therapists at the same time.
  - Warn on same-day appointments with another therapist (confirmation prompt).

### Roles / Visibility
- **Admin**: sees all appointments and can run sync.
- **Therapist**: sees only their own appointments.

### In-App Notifications
- Bell icon popover with a badge counter.
- Notifications are persisted per user scope (admin / therapist).
- Notifications are generated for appointment changes (depending on the implemented rules):
  - Created / assigned to therapist
  - Cancelled / removed
  - Time changed (with suppression to avoid self-change noise)
- Clear / dismiss notifications and persist dismissed IDs.

### Medplum Sync (Appointments)
- Admin-only sync button.
- If Medplum is not connected, user receives a clear message and sync does not run.
- Sync creates/updates Appointment resources in Medplum and stores returned remote IDs.
- Pending sync and sync errors are tracked per appointment.

---

## 🧰 Tech Stack

- React + React Router
- Vite
- FullCalendar (timeGrid/dayGrid/interaction)
- Medplum SDK
- CSS (per page/component)
- Browser storage for persistence (local storage / implemented stores)
- Testing: Vitest + Testing Library (configured in the project)

---

## 💾 Data & Persistence

- App data is stored client-side.
- Appointments and notifications persist across refresh based on the implemented stores.
- Notifications are scoped per user key (admin or therapist).

---

## 🚀 Run Locally

```bash
npm install
npm run dev
---

## 🔀 Git Workflow

- `main-clean` is protected and accepts changes via Pull Requests only.
- Development is done on feature branches.
- Approved changes are merged into `main-clean`.

```
bash
npm install
npm run dev
