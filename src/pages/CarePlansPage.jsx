import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CarePlansPage.css";
import { formatDateTimeDMY } from "../utils/dateFormat";
import { medplum } from "../medplumClient";
import { loadCarePlanTemplatesEnsured } from "../services/carePlanTemplates";

import kneeRehabilitation from "../seed/exercise-library/knee_rehabilitation.json";
import lowBackPain from "../seed/exercise-library/low_back_pain.json";
import shoulderMobility from "../seed/exercise-library/shoulder_mobility.json";
import postOpGeneralActivity from "../seed/exercise-library/post_op_general_activity.json";
import balanceTraining from "../seed/exercise-library/balance_training.json";

const SEED_TEMPLATES = [
  kneeRehabilitation,
  lowBackPain,
  shoulderMobility,
  postOpGeneralActivity,
  balanceTraining,
];

// ✅ Local templates storage (no new files, no CSS changes)
const LOCAL_TEMPLATES_KEY = "careplan_templates_custom_v1";

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function safeJsonStringify(obj) {
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return "{}";
  }
}

function loadLocalCustomTemplatesRaw() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_TEMPLATES_KEY);
  const parsed = safeJsonParse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function saveLocalCustomTemplatesRaw(arr) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_TEMPLATES_KEY, JSON.stringify(Array.isArray(arr) ? arr : []));
}

function toTitle(obj) {
  return String(obj?.category || obj?.title || obj?.name || "Template").trim() || "Template";
}

function toExerciseCount(obj) {
  const ex = Array.isArray(obj?.exercises) ? obj.exercises : [];
  return ex.length;
}

function toPatientId(p) {
  return String(p?.idNumber || p?.id || "").trim();
}

function fullName(p) {
  const first = String(p?.firstName || "").trim();
  const last = String(p?.lastName || "").trim();
  const name = `${first} ${last}`.trim();
  return name || "Unknown patient";
}

function getGenderNameClass(g) {
  const s = String(g || "").toLowerCase().trim();
  if (s === "female") return "patient-name-female";
  if (s === "male") return "patient-name-male";
  return "patient-name-other";
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
  const title =
    String(templateJson?.category || templateJson?.title || "Care plan").trim() || "Care plan";

  const exercisesRaw = Array.isArray(templateJson?.exercises) ? templateJson.exercises : [];

  const exercises = exercisesRaw
    .filter(Boolean)
    .map((x) => {
      const name = String(x?.name || "").trim();
      const instructions = String(x?.instructions || "");
      const frequency = String(x?.defaultFrequency || x?.frequency || "").trim();

      const sets =
        typeof x?.defaultSets === "number"
          ? x.defaultSets
          : typeof x?.sets === "number"
          ? x.sets
          : undefined;

      const reps =
        typeof x?.defaultReps === "number"
          ? x.defaultReps
          : typeof x?.reps === "number"
          ? x.reps
          : undefined;

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
    const gender = p?.gender;

    const draft = p?.carePlanDraft;
    if (draft && typeof draft === "object") {
      rows.push({
        patientId,
        patientName,
        patientGender: gender,
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
        patientId,
        patientName,
        patientGender: gender,
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
  const [templatesLoading, setTemplatesLoading] = useState(false);

  // local custom templates state
  const [customTemplates, setCustomTemplates] = useState(() => {
    // map raw storage -> UI templates
    const raw = loadLocalCustomTemplatesRaw();
    return raw
      .filter((x) => x && typeof x === "object" && x.raw && typeof x.raw === "object")
      .map((x) => ({
        id: String(x.id),
        title: String(x.title || toTitle(x.raw)),
        count: toExerciseCount(x.raw),
        raw: x.raw,
        source: "local-custom",
        updatedAt: x.updatedAt || "",
      }));
  });

  const [query, setQuery] = useState("");
  const [showTemplates, setShowTemplates] = useState(true);
  const [showActive, setShowActive] = useState(true);

  const [assignOpen, setAssignOpen] = useState(false);
  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  // ✅ Template editor modal (no new CSS)
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState("new"); // "new" | "edit"
  const [editorTemplateId, setEditorTemplateId] = useState("");
  const [editorTitle, setEditorTitle] = useState("");
  const [editorJson, setEditorJson] = useState("");
  const [editorError, setEditorError] = useState("");

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

  // ✅ merge templates: custom first, then cloud/seed results
  const templatesMerged = useMemo(() => {
    const seen = new Set();
    const out = [];

    customTemplates.forEach((t) => {
      if (!t?.id) return;
      if (seen.has(t.id)) return;
      seen.add(t.id);
      out.push(t);
    });

    (templates || []).forEach((t) => {
      if (!t?.id) return;
      const key = `med_${t.id}`;
      // keep ids unique across sources
      out.push({ ...t, id: key, source: t.source || "medplum-or-seed" });
    });

    return out;
  }, [customTemplates, templates]);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setTemplatesLoading(true);
        const results = await loadCarePlanTemplatesEnsured(medplum, SEED_TEMPLATES);
        if (!cancelled) {
          setTemplates(results);
          setTemplatesError("");
        }
      } catch (e) {
        if (!cancelled) {
          setTemplates([]);
          const msg =
            e?.message && typeof e.message === "string" ? e.message : "Failed to load templates.";
          setTemplatesError(msg);
        }
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }

    loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  function persistCustomTemplates(nextUiTemplates) {
    setCustomTemplates(nextUiTemplates);

    const raw = (nextUiTemplates || []).map((t) => ({
      id: String(t.id),
      title: String(t.title || toTitle(t.raw)),
      raw: t.raw || {},
      updatedAt: t.updatedAt || new Date().toISOString(),
    }));
    saveLocalCustomTemplatesRaw(raw);
  }

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
    const filename = `${item.patientId}_careplan.json`;
    downloadJson(filename, item.raw);
  }

  function downloadTemplate(t) {
    const safeTitle = String(t?.title || "template")
      .trim()
      .replace(/[^\w\- ]+/g, "")
      .replace(/\s+/g, "_");
    const filename = `${safeTitle || "template"}.json`;
    downloadJson(filename, t?.raw || {});
  }

  // ✅ Editor actions
  function openNewTemplate() {
    setEditorMode("new");
    setEditorTemplateId("");
    setEditorTitle("New template");
    setEditorJson(
      safeJsonStringify({
        category: "New template",
        exercises: [],
      })
    );
    setEditorError("");
    setEditorOpen(true);
  }

  function openEditTemplate(t) {
    // only allow editing local-custom (so we don't edit seed/medplum accidentally)
    if (t?.source !== "local-custom") {
      alert("This template is not editable here. Duplicate it first.");
      return;
    }
    setEditorMode("edit");
    setEditorTemplateId(String(t.id));
    setEditorTitle(String(t.title || toTitle(t.raw)));
    setEditorJson(safeJsonStringify(t.raw || {}));
    setEditorError("");
    setEditorOpen(true);
  }

  function closeEditor() {
    setEditorOpen(false);
    setEditorError("");
  }

  function saveEditor() {
    const title = String(editorTitle || "").trim();
    if (!title) {
      setEditorError("Title is required.");
      return;
    }

    const parsed = safeJsonParse(editorJson);
    if (!parsed || typeof parsed !== "object") {
      setEditorError("JSON is invalid.");
      return;
    }

    // very light validation: must have exercises array (can be empty)
    if (parsed.exercises !== undefined && !Array.isArray(parsed.exercises)) {
      setEditorError("Template JSON: 'exercises' must be an array.");
      return;
    }
    if (parsed.exercises === undefined) {
      parsed.exercises = [];
    }

    // keep category aligned with title if user didn't set it
    if (!parsed.category) parsed.category = title;

    const now = new Date().toISOString();

    if (editorMode === "edit" && editorTemplateId) {
      const next = customTemplates.map((t) =>
        String(t.id) === String(editorTemplateId)
          ? {
              ...t,
              title,
              raw: parsed,
              count: toExerciseCount(parsed),
              updatedAt: now,
            }
          : t
      );
      persistCustomTemplates(next);
      setEditorOpen(false);
      return;
    }

    // new
    const id = createId("tpl");
    const next = [
      {
        id,
        title,
        raw: parsed,
        count: toExerciseCount(parsed),
        source: "local-custom",
        updatedAt: now,
      },
      ...customTemplates,
    ];
    persistCustomTemplates(next);
    setEditorOpen(false);
  }

  function duplicateTemplate(t) {
    const baseRaw = t?.raw && typeof t.raw === "object" ? t.raw : {};
    const now = new Date().toISOString();
    const id = createId("tpl");
    const title = `${String(t?.title || toTitle(baseRaw))} (copy)`;

    const next = [
      {
        id,
        title,
        raw: baseRaw,
        count: toExerciseCount(baseRaw),
        source: "local-custom",
        updatedAt: now,
      },
      ...customTemplates,
    ];
    persistCustomTemplates(next);
  }

  function deleteTemplate(t) {
    if (t?.source !== "local-custom") {
      alert("Seed/Medplum templates can't be deleted here.");
      return;
    }
    const ok = confirm(`Delete "${t.title}"?`);
    if (!ok) return;

    const next = customTemplates.filter((x) => String(x.id) !== String(t.id));
    persistCustomTemplates(next);
  }

  return (
    <div className="careplans-page">
      <section className="patient-card careplans-card-outline">
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
        <section className="patient-card careplans-card-outline">
          <div className="careplans-section-head">
            <h2 className="section-title">Templates</h2>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <div className="careplans-count">{templatesMerged.length}</div>
              <button type="button" className="header-chip-btn" onClick={openNewTemplate}>
                New template
              </button>
            </div>
          </div>

          {templatesLoading ? (
            <div className="careplans-empty">Loading templates...</div>
          ) : templatesError ? (
            <div className="careplans-empty">{templatesError}</div>
          ) : templatesMerged.length === 0 ? (
            <div className="careplans-empty">No templates found.</div>
          ) : (
            <div className="careplans-templates-grid">
              {templatesMerged.map((t) => (
                <div className="careplans-template-tile" key={t.id}>
                  <div className="careplans-tile-top">
                    <div className="careplans-tile-title">{t.title}</div>
                    <div className="careplans-mini-meta">Exercises: {t.count}</div>
                  </div>

                  <div className="careplans-tile-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                    <button
                      type="button"
                      className="header-chip-btn careplans-link"
                      onClick={() => downloadTemplate(t)}
                    >
                      Download
                    </button>

                    <button type="button" className="header-chip-btn" onClick={() => openAssign(t)}>
                      Assign
                    </button>

                    <button type="button" className="header-chip-btn" onClick={() => duplicateTemplate(t)}>
                      Duplicate
                    </button>

                    <button type="button" className="header-chip-btn" onClick={() => openEditTemplate(t)}>
                      Edit
                    </button>

                    <button type="button" className="header-chip-btn" onClick={() => deleteTemplate(t)}>
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {showActive ? (
        <section className="patient-card careplans-card-outline">
          <div className="careplans-section-head">
            <h2 className="section-title">Active care plans</h2>
            <div className="careplans-count">{activePlans.length}</div>
          </div>

          {activePlans.length === 0 ? (
            <div className="careplans-empty">No active care plans yet.</div>
          ) : (
            <div className="careplans-active-list">
              {activePlans.map((it) => (
                <div className="careplans-active-row" key={`${it.patientId}_${it.carePlanId}`}>
                  <div className="careplans-active-main">
                    <div className="careplans-active-title">Care plan</div>

                    <div className="careplans-active-line">
                      <span className={"careplans-patient-name " + getGenderNameClass(it.patientGender)}>
                        {it.patientName}
                      </span>
                      <span className="careplans-patient-id">ID: {it.patientId}</span>
                    </div>

                    <div className="careplans-active-meta">
                      <span className="careplans-meta-item">Exercises: {it.exerciseCount}</span>
                      <span className="careplans-meta-item">Goals: {it.goalsCount}</span>
                      <span className="careplans-meta-item">
                        Updated: <bdi dir="ltr">{it.updatedAt ? formatDateTimeDMY(it.updatedAt) : "—"}</bdi>
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
          <div className="careplans-modal careplans-card-outline">
            <div className="careplans-modal-header">
              <div className="careplans-modal-title">Assign template</div>
              <button type="button" className="careplans-modal-close" onClick={closeAssign}>
                ✕
              </button>
            </div>

            <div className="careplans-modal-body">
              <div className="careplans-field">
                <div className="careplans-label">Template</div>
                <div className="careplans-value">{selectedTemplate?.title || "—"}</div>
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

      {editorOpen ? (
        <div
          className="careplans-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeEditor();
          }}
        >
          <div className="careplans-modal careplans-card-outline">
            <div className="careplans-modal-header">
              <div className="careplans-modal-title">
                {editorMode === "edit" ? "Edit template" : "New template"}
              </div>
              <button type="button" className="careplans-modal-close" onClick={closeEditor}>
                ✕
              </button>
            </div>

            <div className="careplans-modal-body">
              <div className="careplans-field">
                <div className="careplans-label">Title</div>
                <input
                  className="inline-input"
                  value={editorTitle}
                  onChange={(e) => setEditorTitle(e.target.value)}
                  placeholder="Template title..."
                />
              </div>

              <div className="careplans-field">
                <div className="careplans-label">Template JSON</div>
                <textarea
                  className="inline-input"
                  style={{ minHeight: 220, fontFamily: "monospace", whiteSpace: "pre" }}
                  value={editorJson}
                  onChange={(e) => setEditorJson(e.target.value)}
                  spellCheck={false}
                />
                {editorError ? <div className="careplans-empty">{editorError}</div> : null}
              </div>

              <div className="careplans-modal-actions">
                <button type="button" className="header-chip-btn" onClick={closeEditor}>
                  Cancel
                </button>
                <button type="button" className="header-chip-btn" onClick={saveEditor}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
