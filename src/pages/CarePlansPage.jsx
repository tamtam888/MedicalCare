import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CarePlansPage.css";
import { formatDateTimeDMY } from "../utils/dateFormat";

const TEMPLATE_FILES = [
  "/exercise-library/knee_rehabilitation.json",
  "/exercise-library/low_back_pain.json",
  "/exercise-library/shoulder_mobility.json",
  "/exercise-library/post_op_general_activity.json",
  "/exercise-library/balance_training.json",
];

function toPatientId(p) {
  return String(p?.idNumber || p?.id || "").trim();
}

function fullName(p) {
  const first = String(p?.firstName || "").trim();
  const last = String(p?.lastName || "").trim();
  const name = `${first} ${last}`.trim();
  return name || "Unknown patient";
}

function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.();
  return id ? `${prefix}_${id}` : `${prefix}_${Date.now()}`;
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function mapTemplateToCarePlanDraft(templateJson) {
  const now = new Date().toISOString();
  const title = String(templateJson?.category || templateJson?.title || "Care plan").trim() || "Care plan";
  const exercisesRaw = Array.isArray(templateJson?.exercises) ? templateJson.exercises : [];

  const exercises = exercisesRaw
    .filter(Boolean)
    .map((x) => {
      const name = String(x?.name || "").trim();
      const instructions = String(x?.instructions || "");
      const frequency = String(x?.defaultFrequency || x?.frequency || "").trim();
      const sets = typeof x?.defaultSets === "number" ? x.defaultSets : typeof x?.sets === "number" ? x.sets : undefined;
      const reps = typeof x?.defaultReps === "number" ? x.defaultReps : typeof x?.reps === "number" ? x.reps : undefined;
      const durationMin =
        typeof x?.defaultDurationMin === "number"
          ? x.defaultDurationMin
          : typeof x?.durationMin === "number"
          ? x.durationMin
          : undefined;

      return {
        id: x?.id ? String(x.id) : createId("ex"),
        name,
        instructions,
        frequency,
        sets,
        reps,
        durationMin,
      };
    })
    .filter((x) => x.name && x.frequency);

  return {
    id: createId("cp"),
    title,
    updatedAt: now,
    goals: [],
    exercises,
  };
}

function getAllActiveCarePlans(patients) {
  const rows = [];

  (patients || []).forEach((p) => {
    const patientId = toPatientId(p);
    if (!patientId) return;

    const patientName = fullName(p);

    const draft = p?.carePlanDraft;
    if (draft && typeof draft === "object") {
      rows.push({
        kind: "draft",
        patientId,
        patientName,
        carePlanId: String(draft.id || ""),
        title: String(draft.title || "Care plan"),
        updatedAt: draft.updatedAt || "",
        goalsCount: Array.isArray(draft.goals) ? draft.goals.length : 0,
        exerciseCount: Array.isArray(draft.exercises) ? draft.exercises.length : 0,
        raw: draft,
      });
    }

    const plans = Array.isArray(p?.carePlans) ? p.carePlans : [];
    plans.forEach((cp) => {
      if (!cp || typeof cp !== "object") return;
      rows.push({
        kind: "saved",
        patientId,
        patientName,
        carePlanId: String(cp.id || ""),
        title: String(cp.title || "Care plan"),
        updatedAt: cp.updatedAt || "",
        goalsCount: Array.isArray(cp.goals) ? cp.goals.length : 0,
        exerciseCount: Array.isArray(cp.exercises) ? cp.exercises.length : 0,
        raw: cp,
      });
    });
  });

  rows.sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
  return rows;
}

export default function CarePlansPage({ patients = [], onUpdatePatient }) {
  const navigate = useNavigate();

  const [templates, setTemplates] = useState([]);
  const [templatesError, setTemplatesError] = useState("");

  const [query, setQuery] = useState("");
  const [showTemplates, setShowTemplates] = useState(true);
  const [showActive, setShowActive] = useState(true);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const activePlansAll = useMemo(() => getAllActiveCarePlans(patients), [patients]);

  const activePlans = useMemo(() => {
    const q = String(query || "").trim().toLowerCase();
    if (!q) return activePlansAll;

    return activePlansAll.filter((x) => {
      return (
        String(x.title || "").toLowerCase().includes(q) ||
        String(x.patientName || "").toLowerCase().includes(q) ||
        String(x.patientId || "").toLowerCase().includes(q)
      );
    });
  }, [activePlansAll, query]);

  const patientOptions = useMemo(() => {
    return (patients || [])
      .map((p) => ({ id: toPatientId(p), name: fullName(p) }))
      .filter((x) => x.id);
  }, [patients]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        const results = await Promise.all(
          TEMPLATE_FILES.map(async (path) => {
            const res = await fetch(path, { cache: "no-store" });
            if (!res.ok) throw new Error("Template load failed");
            const json = await res.json();
            return {
              path,
              category: String(json?.category || json?.title || "Template"),
              count: Array.isArray(json?.exercises) ? json.exercises.length : 0,
              raw: json,
            };
          })
        );

        if (!cancelled) {
          setTemplates(results);
          setTemplatesError("");
        }
      } catch {
        if (!cancelled) setTemplatesError("Failed to load templates.");
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  function openAssign(template) {
    setSelectedTemplate(template);
    setSelectedPatientId(patientOptions[0]?.id || "");
    setAssignOpen(true);
  }

  function closeAssign() {
    setAssignOpen(false);
    setSelectedTemplate(null);
  }

  function assignTemplate() {
    if (!selectedTemplate || !selectedPatientId) return;
    if (typeof onUpdatePatient !== "function") return;

    const patient = (patients || []).find((p) => toPatientId(p) === selectedPatientId);
    if (!patient) return;

    const draft = mapTemplateToCarePlanDraft(selectedTemplate.raw);
    onUpdatePatient({ ...patient, carePlanDraft: draft });

    setAssignOpen(false);
    navigate(`/patients/${selectedPatientId}`);
  }

  function exportActive(item) {
    const filename = `${item.patientId}_${item.kind}_careplan.json`;
    downloadJson(filename, item.raw);
  }

  return (
    <div className="careplans-page">
      <section className="patient-card">
        <div className="careplans-header">
          <div>
            <h2 className="section-title">Care plans</h2>
            <div className="careplans-subtitle">Templates and active patient care plans.</div>
          </div>

          <div className="careplans-header-actions">
            <button type="button" className="header-chip-btn" onClick={() => navigate("/patients")}>
              Patients
            </button>
          </div>
        </div>

        <div className="careplans-toolbar">
          <input
            className="inline-input careplans-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by patient, ID, or plan title..."
          />

          <div className="careplans-toggles">
            <button
              type="button"
              className={"header-chip-btn" + (showTemplates ? " careplans-chip-active" : "")}
              onClick={() => setShowTemplates((v) => !v)}
            >
              Templates
            </button>
            <button
              type="button"
              className={"header-chip-btn" + (showActive ? " careplans-chip-active" : "")}
              onClick={() => setShowActive((v) => !v)}
            >
              Active
            </button>
          </div>
        </div>
      </section>

      {showTemplates ? (
        <section className="patient-card">
          <div className="careplans-section-head">
            <h2 className="section-title">Templates</h2>
            <div className="careplans-count">{templates.length}</div>
          </div>

          {templatesError ? (
            <div className="careplans-empty">{templatesError}</div>
          ) : templates.length === 0 ? (
            <div className="careplans-empty">No templates found.</div>
          ) : (
            <div className="careplans-list">
              {templates.map((t) => (
                <div className="careplans-row careplans-row-compact" key={t.path}>
                  <div className="careplans-main">
                    <div className="careplans-title">{t.category}</div>
                    <div className="careplans-meta">
                      <span className="careplans-pill">
                        <strong>Exercises:</strong> {t.count}
                      </span>
                    </div>
                  </div>

                  <div className="careplans-actions">
                    <a className="header-chip-btn careplans-link" href={t.path} download>
                      Download
                    </a>
                    <button type="button" className="header-chip-btn" onClick={() => openAssign(t)}>
                      Assign
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showActive ? (
        <section className="patient-card">
          <div className="careplans-section-head">
            <h2 className="section-title">Active care plans</h2>
            <div className="careplans-count">{activePlans.length}</div>
          </div>

          {activePlans.length === 0 ? (
            <div className="careplans-empty">No active care plans yet.</div>
          ) : (
            <div className="careplans-list">
              {activePlans.map((it) => (
                <div className="careplans-row careplans-row-compact" key={`${it.kind}_${it.patientId}_${it.carePlanId}`}>
                  <div className="careplans-main">
                    <div className="careplans-title">
                      {it.title} <span className="careplans-type">({it.kind})</span>
                    </div>

                    <div className="careplans-meta">
                      <span className="careplans-pill">
                        <strong>Patient:</strong> {it.patientName} (ID: {it.patientId})
                      </span>
                      <span className="careplans-pill">
                        <strong>Exercises:</strong> {it.exerciseCount}
                      </span>
                      <span className="careplans-pill">
                        <strong>Updated:</strong>{" "}
                        <bdi dir="ltr">{it.updatedAt ? formatDateTimeDMY(it.updatedAt) : "—"}</bdi>
                      </span>
                    </div>
                  </div>

                  <div className="careplans-actions">
                    <button type="button" className="header-chip-btn" onClick={() => exportActive(it)}>
                      Export
                    </button>
                    <button type="button" className="header-chip-btn" onClick={() => navigate(`/patients/${it.patientId}`)}>
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {assignOpen ? (
        <div
          className="careplans-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeAssign();
          }}
        >
          <div className="careplans-modal">
            <div className="careplans-modal-header">
              <div className="careplans-modal-title">Assign template</div>
              <button type="button" className="careplans-modal-close" onClick={closeAssign}>
                ✕
              </button>
            </div>

            <div className="careplans-modal-body">
              <div className="careplans-field">
                <div className="careplans-label">Template</div>
                <div className="careplans-value">{selectedTemplate?.category || "—"}</div>
              </div>

              <div className="careplans-field">
                <div className="careplans-label">Patient</div>
                <select
                  className="inline-input"
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                >
                  {patientOptions.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} (ID: {p.id})
                    </option>
                  ))}
                </select>
              </div>

              <div className="careplans-modal-actions">
                <button type="button" className="header-chip-btn" onClick={closeAssign}>
                  Cancel
                </button>
                <button type="button" className="header-chip-btn" onClick={assignTemplate}>
                  Assign
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
