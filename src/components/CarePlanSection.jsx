import React, { useEffect, useMemo, useRef, useState } from "react";
import "./CarePlanSection.css";
import CarePlanGoals from "./CarePlanGoals";
import CarePlanExercises from "./CarePlanExercises";
import { formatDateTimeDMY } from "../utils/dateFormat";
import {
  toFhirCarePlanBundle,
  downloadJson as downloadFhirJson,
} from "../utils/fhirCarePlan";

function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.();
  return id ? `${prefix}_${id}` : `${prefix}_${Date.now()}`;
}

function downloadJsonInternal(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function normalizeImportedGoals(goalsRaw) {
  if (!Array.isArray(goalsRaw)) return [];
  return goalsRaw
    .filter(Boolean)
    .map((g) => ({
      id: g?.id || createId("goal"),
      title: String(g?.title || ""),
      status: String(g?.status || "Planned"),
      targetDate: g?.targetDate || undefined,
      notes: String(g?.notes || ""),
    }))
    .filter((g) => g.title.trim().length > 0);
}

function normalizeImportedExercises(exercisesRaw) {
  if (!Array.isArray(exercisesRaw)) return [];
  return exercisesRaw
    .filter(Boolean)
    .map((x) => ({
      id: x?.id || createId("ex"),
      name: String(x?.name || ""),
      instructions: String(x?.instructions || ""),
      frequency: String(x?.frequency || ""),
      sets: typeof x?.sets === "number" ? x.sets : undefined,
      reps: typeof x?.reps === "number" ? x.reps : undefined,
      durationMin: typeof x?.durationMin === "number" ? x.durationMin : undefined,
      startDate: x?.startDate || undefined,
      endDate: x?.endDate || undefined,
    }))
    .filter((x) => x.name.trim().length > 0 && x.frequency.trim().length > 0);
}

function normalizeImportedCarePlan(obj) {
  if (!obj || typeof obj !== "object") return null;

  return {
    id: obj.id || createId("cp"),
    title: String(obj.title || "Care plan"),
    updatedAt: obj.updatedAt || new Date().toISOString(),
    goals: normalizeImportedGoals(obj.goals),
    exercises: normalizeImportedExercises(obj.exercises),
  };
}

export default function CarePlanSection({ patient, onUpdatePatient }) {
  const fileRef = useRef(null);
  const draft = patient?.carePlanDraft || null;

  const [exportOpen, setExportOpen] = useState(false);
  const exportRef = useRef(null);

  useEffect(() => {
    const onClickOutside = (e) => {
      if (exportRef.current && !exportRef.current.contains(e.target)) {
        setExportOpen(false);
      }
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const meta = useMemo(() => {
    return {
      goalsCount: Array.isArray(draft?.goals) ? draft.goals.length : 0,
      exerciseCount: Array.isArray(draft?.exercises) ? draft.exercises.length : 0,
      updatedText: draft?.updatedAt ? formatDateTimeDMY(draft.updatedAt) : "",
    };
  }, [draft]);

  function updateDraft(nextDraft) {
    onUpdatePatient?.({
      ...patient,
      carePlanDraft: nextDraft,
    });
  }

  function createDraft() {
    updateDraft({
      id: createId("cp"),
      title: "Care plan",
      updatedAt: new Date().toISOString(),
      goals: [],
      exercises: [],
    });
  }

  function clearDraft() {
    if (!window.confirm("Delete the current care plan draft?")) return;
    updateDraft(null);
  }

  async function onImportFile(e) {
    const file = e?.target?.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      const normalized = normalizeImportedCarePlan(parsed);
      if (!normalized) throw new Error();
      updateDraft({ ...normalized, updatedAt: new Date().toISOString() });
    } catch {
      alert("Invalid care plan file.");
    } finally {
      if (e.target) e.target.value = "";
    }
  }

  function exportInternal() {
    if (!draft) return;
    const filename = `${patient?.idNumber || "patient"}_careplan.internal.json`;
    downloadJsonInternal(filename, draft);
  }

  function exportFhir() {
    if (!draft) return;

    const bundle = toFhirCarePlanBundle({
      patient,
      carePlanDraft: draft,
      includePatient: true,
    });

    const filename = `${patient?.idNumber || "patient"}_careplan.fhir.bundle.json`;
    downloadFhirJson(filename, bundle);
  }

  function onGoalsChange(nextGoals) {
    updateDraft({
      ...(draft || createDraft()),
      goals: nextGoals,
      exercises: draft?.exercises || [],
      updatedAt: new Date().toISOString(),
    });
  }

  function onExercisesChange(nextExercises) {
    updateDraft({
      ...(draft || createDraft()),
      goals: draft?.goals || [],
      exercises: nextExercises,
      updatedAt: new Date().toISOString(),
    });
  }

  return (
    <div className="careplan-section">
      <div className="careplan-actions">
        {draft ? (
          <>
            <div className="export-dropdown" ref={exportRef}>
              <button
                type="button"
                className="header-chip-btn"
                onClick={() => setExportOpen((v) => !v)}
              >
                Export ▾
              </button>

              {exportOpen && (
                <div className="export-menu">
                  <button
                    type="button"
                    className="export-menu-item"
                    onClick={() => {
                      setExportOpen(false);
                      exportInternal();
                    }}
                  >
                    Export as MedicalCare JSON
                  </button>

                  <button
                    type="button"
                    className="export-menu-item"
                    onClick={() => {
                      setExportOpen(false);
                      exportFhir();
                    }}
                  >
                    Export as FHIR Bundle
                  </button>
                </div>
              )}
            </div>

            <label className="header-chip-btn careplan-import-label">
              Import care plan
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="careplan-import-input"
                onChange={onImportFile}
              />
            </label>

            <button
              type="button"
              className="header-chip-btn careplan-danger"
              onClick={clearDraft}
            >
              Delete draft
            </button>
          </>
        ) : (
          <>
            <button type="button" className="header-chip-btn" onClick={createDraft}>
              Create care plan
            </button>

            <label className="header-chip-btn careplan-import-label">
              Import care plan
              <input
                ref={fileRef}
                type="file"
                accept="application/json"
                className="careplan-import-input"
                onChange={onImportFile}
              />
            </label>
          </>
        )}
      </div>

      {draft ? (
        <>
          <div className="careplan-summary">
            <div className="careplan-summary-item">
              <span className="careplan-summary-label">Goals</span>
              <span className="careplan-summary-value">{meta.goalsCount}</span>
            </div>

            <div className="careplan-summary-item">
              <span className="careplan-summary-label">Exercises</span>
              <span className="careplan-summary-value">{meta.exerciseCount}</span>
            </div>

            <div className="careplan-summary-item">
              <span className="careplan-summary-label">Last update</span>
              <span className="careplan-summary-value">
                <bdi dir="ltr">{meta.updatedText || "—"}</bdi>
              </span>
            </div>
          </div>

          <CarePlanGoals value={draft.goals || []} onChange={onGoalsChange} />
          <CarePlanExercises value={draft.exercises || []} onChange={onExercisesChange} />
        </>
      ) : (
        <div className="careplan-empty">No care plan draft yet.</div>
      )}
    </div>
  );
}
