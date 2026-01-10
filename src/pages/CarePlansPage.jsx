// src/pages/CarePlansPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./CarePlansPage.css";
import { medplum } from "../medplumClient";
import {
  loadCarePlanTemplatesEnsured,
  syncSeedTemplatesToMedplum,
} from "../services/carePlanTemplates";
import { listExercises, seedLocalExercisesOnce, upsertLocalExercise, archiveLocalExercise } from "../services/exerciseLibrary";

import kneeRehabilitation from "../seed/exercise-library/knee_rehabilitation.json";
import lowBackPain from "../seed/exercise-library/low_back_pain.json";
import shoulderMobility from "../seed/exercise-library/shoulder_mobility.json";
import postOpGeneralActivity from "../seed/exercise-library/post_op_general_activity.json";
import balanceTraining from "../seed/exercise-library/balance_training.json";

const SEED_TEMPLATES = [kneeRehabilitation, lowBackPain, shoulderMobility, postOpGeneralActivity, balanceTraining];

function toExerciseCount(obj) {
  const ex = Array.isArray(obj?.exercises) ? obj.exercises : [];
  return ex.length;
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

function normalizeTemplateExercise(x) {
  const obj = x && typeof x === "object" ? x : {};
  return {
    name: String(obj.name || "").trim(),
    instructions: String(obj.instructions || "").trim(),
    tags: Array.isArray(obj.tags) ? obj.tags.map((t) => String(t || "").trim()).filter(Boolean) : [],
    mediaUrl: obj.mediaUrl ? String(obj.mediaUrl).trim() : "",
  };
}

function extractSeedExercises(seedTemplates) {
  const out = [];
  const list = Array.isArray(seedTemplates) ? seedTemplates : [];
  for (const tpl of list) {
    const exercises = Array.isArray(tpl?.exercises) ? tpl.exercises : [];
    for (const ex of exercises) {
      const n = normalizeTemplateExercise(ex);
      if (!n.name) continue;
      out.push({
        name: n.name,
        instructions: n.instructions,
        tags: n.tags,
        mediaUrl: n.mediaUrl,
        scope: "global",
        archived: false,
      });
    }
  }
  return out;
}

export default function CarePlansPage() {
  const navigate = useNavigate();

  const [activeFolder, setActiveFolder] = useState(null); // "templates" | "exercises" | null

  const [templatesOpen, setTemplatesOpen] = useState(true);
  const [exercisesOpen, setExercisesOpen] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [templatesError, setTemplatesError] = useState("");
  const [templatesLoading, setTemplatesLoading] = useState(false);

  const [seedSyncing, setSeedSyncing] = useState(false);
  const [seedSyncMsg, setSeedSyncMsg] = useState("");

  const [customTemplates, setCustomTemplates] = useState(() => {
    return [];
  });

  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);
  const [templateEditorMode, setTemplateEditorMode] = useState("new");
  const [templateEditorTemplateId, setTemplateEditorTemplateId] = useState("");
  const [templateEditorTitle, setTemplateEditorTitle] = useState("");
  const [templateEditorError, setTemplateEditorError] = useState("");

  const [templatePickerQuery, setTemplatePickerQuery] = useState("");
  const [templateSelected, setTemplateSelected] = useState([]); // [{ name, instructions, tags, mediaUrl }]

  const [templateSyncingId, setTemplateSyncingId] = useState("");
  const [templateSyncMsg, setTemplateSyncMsg] = useState("");

  const [exercises, setExercises] = useState([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [exercisesError, setExercisesError] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [showArchivedExercises, setShowArchivedExercises] = useState(false);

  const [exerciseEditorOpen, setExerciseEditorOpen] = useState(false);
  const [exerciseEditorMode, setExerciseEditorMode] = useState("new");
  const [exerciseEditorId, setExerciseEditorId] = useState("");
  const [exerciseName, setExerciseName] = useState("");
  const [exerciseInstructions, setExerciseInstructions] = useState("");
  const [exerciseTags, setExerciseTags] = useState("");
  const [exerciseScope, setExerciseScope] = useState("global");
  const [exerciseEditorError, setExerciseEditorError] = useState("");

  const templatesMerged = useMemo(() => {
    const out = [];
    const seen = new Set();

    (customTemplates || []).forEach((t) => {
      if (!t?.id) return;
      if (seen.has(t.id)) return;
      seen.add(t.id);
      out.push(t);
    });

    (templates || []).forEach((t) => {
      if (!t?.id) return;
      if (seen.has(t.id)) return;
      seen.add(t.id);
      out.push(t);
    });

    return out;
  }, [customTemplates, templates]);

  const filteredExercises = useMemo(() => {
    const q = String(exerciseQuery || "").trim().toLowerCase();
    const base = Array.isArray(exercises) ? exercises : [];
    const visible = showArchivedExercises ? base : base.filter((x) => !x.archived);

    if (!q) return visible;
    return visible.filter((x) => {
      const name = String(x.name || "").toLowerCase();
      const tags = Array.isArray(x.tags) ? x.tags.join(", ").toLowerCase() : "";
      return name.includes(q) || tags.includes(q);
    });
  }, [exercises, exerciseQuery, showArchivedExercises]);

  const exerciseGroups = useMemo(() => {
    const map = new Map();
    for (const ex of filteredExercises) {
      const firstTag = Array.isArray(ex.tags) && ex.tags.length > 0 ? String(ex.tags[0]) : "General";
      const key = firstTag || "General";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(ex);
    }
    const keys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
    return keys.map((k) => ({ key: k, items: map.get(k) }));
  }, [filteredExercises]);

  const pickerResults = useMemo(() => {
    const q = String(templatePickerQuery || "").trim().toLowerCase();
    const base = (exercises || []).filter((x) => !x.archived);
    if (!q) return base.slice(0, 40);

    return base
      .filter((x) => {
        const name = String(x.name || "").toLowerCase();
        const tags = Array.isArray(x.tags) ? x.tags.join(", ").toLowerCase() : "";
        return name.includes(q) || tags.includes(q);
      })
      .slice(0, 40);
  }, [templatePickerQuery, exercises]);

  useEffect(() => {
    let cancelled = false;

    async function loadAllTemplates() {
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
          const msg = e?.message && typeof e.message === "string" ? e.message : "Failed to load templates.";
          setTemplatesError(msg);
        }
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    }

    loadAllTemplates();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadAllExercises() {
      try {
        setExercisesLoading(true);

        const seedItems = extractSeedExercises(SEED_TEMPLATES);
        seedLocalExercisesOnce(seedItems);

        const rows = await listExercises(medplum, { wantSync: true, includeArchived: true });
        if (!cancelled) {
          setExercises(rows);
          setExercisesError("");
        }
      } catch (e) {
        if (!cancelled) {
          setExercises([]);
          const msg = e?.message && typeof e.message === "string" ? e.message : "Failed to load exercises.";
          setExercisesError(msg);
        }
      } finally {
        if (!cancelled) setExercisesLoading(false);
      }
    }

    loadAllExercises();
    return () => {
      cancelled = true;
    };
  }, []);

  function openNewTemplate() {
    setTemplateEditorMode("new");
    setTemplateEditorTemplateId("");
    setTemplateEditorTitle("New template");
    setTemplateSelected([]);
    setTemplatePickerQuery("");
    setTemplateEditorError("");
    setTemplateSyncMsg("");
    setTemplateEditorOpen(true);
  }

  function closeTemplateEditor() {
    setTemplateEditorOpen(false);
    setTemplateEditorError("");
  }

  function addExerciseToTemplate(ex) {
    const n = normalizeTemplateExercise({
      name: ex?.name,
      instructions: ex?.instructions,
      tags: ex?.tags,
      mediaUrl: ex?.mediaUrl,
    });
    if (!n.name) return;

    const exists = templateSelected.some((t) => String(t.name).toLowerCase() === n.name.toLowerCase());
    if (exists) return;

    setTemplateSelected((prev) => [...prev, n]);
  }

  function removeExerciseFromTemplate(name) {
    const key = String(name || "").trim().toLowerCase();
    setTemplateSelected((prev) => prev.filter((x) => String(x.name || "").trim().toLowerCase() !== key));
  }

  function saveTemplateEditor() {
    const title = String(templateEditorTitle || "").trim();
    if (!title) {
      setTemplateEditorError("Title is required.");
      return;
    }

    const exercisesRaw = (templateSelected || [])
      .map((x) => normalizeTemplateExercise(x))
      .filter((x) => x.name);

    if (exercisesRaw.length === 0) {
      setTemplateEditorError("Please add at least one exercise.");
      return;
    }

    const raw = {
      category: title,
      exercises: exercisesRaw,
    };

    const now = new Date().toISOString();
    const id = templateEditorMode === "edit" && templateEditorTemplateId ? templateEditorTemplateId : createId("tpl");

    const nextRow = {
      id,
      title,
      raw,
      count: toExerciseCount(raw),
      source: "local-custom",
      updatedAt: now,
    };

    const next = [nextRow, ...(customTemplates || []).filter((t) => String(t.id) !== String(id))];
    setCustomTemplates(next);
    setTemplateEditorOpen(false);
  }

  function openEditTemplate(t) {
    if (t?.source !== "local-custom") {
      alert("This template is not editable here. Duplicate it first.");
      return;
    }

    const raw = t?.raw && typeof t.raw === "object" ? t.raw : {};
    const exercisesRaw = Array.isArray(raw?.exercises) ? raw.exercises : [];

    setTemplateEditorMode("edit");
    setTemplateEditorTemplateId(String(t.id));
    setTemplateEditorTitle(String(t.title || "Template"));
    setTemplateSelected(exercisesRaw.map(normalizeTemplateExercise).filter((x) => x.name));
    setTemplatePickerQuery("");
    setTemplateEditorError("");
    setTemplateSyncMsg("");
    setTemplateEditorOpen(true);
  }

  function duplicateTemplate(t) {
    const baseRaw = t?.raw && typeof t.raw === "object" ? t.raw : {};
    const now = new Date().toISOString();
    const id = createId("tpl");
    const title = `${String(t?.title || "Template")} (copy)`;

    const next = [
      { id, title, raw: baseRaw, count: toExerciseCount(baseRaw), source: "local-custom", updatedAt: now },
      ...(customTemplates || []),
    ];
    setCustomTemplates(next);
  }

  function deleteTemplate(t) {
    if (t?.source !== "local-custom") {
      alert("Seed/Medplum templates can't be deleted here.");
      return;
    }
    const ok = confirm(`Delete "${t.title}"?`);
    if (!ok) return;

    const next = (customTemplates || []).filter((x) => String(x.id) !== String(t.id));
    setCustomTemplates(next);
  }

  function downloadTemplate(t) {
    const safeTitle = String(t?.title || "template")
      .trim()
      .replace(/[^\w\- ]+/g, "")
      .replace(/\s+/g, "_");
    const filename = `${safeTitle || "template"}.json`;
    downloadJson(filename, t?.raw || {});
  }

  async function syncSeedNow() {
    setSeedSyncing(true);
    setSeedSyncMsg("");
    try {
      const res = await syncSeedTemplatesToMedplum(medplum, SEED_TEMPLATES);
      const msg = res?.ok
        ? `Seed sync complete. Created: ${res.created || 0}. Skipped: ${res.skipped || 0}.`
        : res?.message || "Seed sync failed.";
      setSeedSyncMsg(msg);

      const after = await loadCarePlanTemplatesEnsured(medplum, SEED_TEMPLATES);
      setTemplates(after);
    } catch (e) {
      setSeedSyncMsg(String(e?.message || "Seed sync failed."));
    } finally {
      setSeedSyncing(false);
    }
  }

  async function syncCustomTemplate(t) {
    if (t?.source !== "local-custom") return;

    setTemplateSyncingId(String(t.id));
    setTemplateSyncMsg("");
    try {
      const res = await syncCustomTemplateToMedplum(medplum, t);
      setTemplateSyncMsg(res?.message || "Sync done.");
      const after = await loadCarePlanTemplatesEnsured(medplum, SEED_TEMPLATES);
      setTemplates(after);
    } catch (e) {
      setTemplateSyncMsg(String(e?.message || "Sync failed."));
    } finally {
      setTemplateSyncingId("");
    }
  }

  function openNewExercise() {
    setExerciseEditorMode("new");
    setExerciseEditorId("");
    setExerciseName("");
    setExerciseInstructions("");
    setExerciseTags("");
    setExerciseScope("global");
    setExerciseEditorError("");
    setExerciseEditorOpen(true);
  }

  function openEditExercise(ex) {
    setExerciseEditorMode("edit");
    setExerciseEditorId(String(ex.id));
    setExerciseName(String(ex.name || ""));
    setExerciseInstructions(String(ex.instructions || ""));
    setExerciseTags(Array.isArray(ex.tags) ? ex.tags.join(", ") : "");
    setExerciseScope(ex.scope === "user" ? "user" : "global");
    setExerciseEditorError("");
    setExerciseEditorOpen(true);
  }

  function closeExerciseEditor() {
    setExerciseEditorOpen(false);
    setExerciseEditorError("");
  }

  async function saveExerciseEditor() {
    const name = String(exerciseName || "").trim();
    if (!name) {
      setExerciseEditorError("Exercise name is required.");
      return;
    }

    const tags = String(exerciseTags || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      upsertLocalExercise({
        id: exerciseEditorMode === "edit" ? exerciseEditorId : undefined,
        name,
        instructions: String(exerciseInstructions || ""),
        tags,
        scope: exerciseScope === "user" ? "user" : "global",
        archived: false,
      });

      const rows = await listExercises(medplum, { wantSync: true, includeArchived: true });
      setExercises(rows);

      setExerciseEditorOpen(false);
    } catch (e) {
      setExerciseEditorError(String(e?.message || "Failed to save exercise."));
    }
  }

  async function archiveExercise(ex) {
    const ok = confirm(`Archive "${ex.name}"?`);
    if (!ok) return;

    archiveLocalExercise(ex.id, true);
    const rows = await listExercises(medplum, { wantSync: true, includeArchived: true });
    setExercises(rows);
  }

  async function restoreExercise(ex) {
    archiveLocalExercise(ex.id, false);
    const rows = await listExercises(medplum, { wantSync: true, includeArchived: true });
    setExercises(rows);
  }

  return (
    <div className="careplans-page">
      <section className="patient-card careplans-card-outline">
        <div className="careplans-header">
          <div>
            <h2 className="section-title">Care plans</h2>
            <div className="careplans-subtitle">Templates & exercise library. Patients are managed in Patients pages.</div>
          </div>

          <div className="careplans-header-actions">
            <button type="button" className="header-chip-btn" onClick={() => navigate("/patients")}>
              Patients
            </button>
          </div>
        </div>

        <div className="careplans-folder-cards">
          <button
            type="button"
            className={"careplans-folder-card" + (activeFolder === "templates" ? " is-active" : "")}
            onClick={() => {
              setActiveFolder("templates");
              setTemplatesOpen(true);
              setExercisesOpen(false);
            }}
          >
            <div className="careplans-folder-card-title">Templates</div>
            <div className="careplans-folder-card-meta">{templatesMerged.length}</div>
          </button>

          <button
            type="button"
            className={"careplans-folder-card" + (activeFolder === "exercises" ? " is-active" : "")}
            onClick={() => {
              setActiveFolder("exercises");
              setTemplatesOpen(false);
              setExercisesOpen(true);
            }}
          >
            <div className="careplans-folder-card-title">Exercise Library</div>
            <div className="careplans-folder-card-meta">{filteredExercises.length}</div>
          </button>
        </div>
      </section>

      <section className="patient-card careplans-card-outline">
        <button
          type="button"
          className={"careplans-folder-head" + (templatesOpen ? " is-open" : "")}
          onClick={() => setTemplatesOpen((v) => !v)}
        >
          <span className="careplans-folder-title">Templates Library</span>
          <span className="careplans-folder-meta">{templatesMerged.length}</span>
          <span className="careplans-folder-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        {templatesOpen ? (
          <div className="careplans-folder-body">
            <div className="careplans-folder-actions">
              <button type="button" className="header-chip-btn" onClick={openNewTemplate}>
                New template
              </button>

              <button type="button" className="header-chip-btn" onClick={syncSeedNow} disabled={seedSyncing}>
                {seedSyncing ? "Syncing..." : "Sync seed to Medplum"}
              </button>
            </div>

            {seedSyncMsg ? <div className="careplans-empty">{seedSyncMsg}</div> : null}
            {templateSyncMsg ? <div className="careplans-empty">{templateSyncMsg}</div> : null}

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
                      <div className="careplans-mini-meta">Source: {t.source}</div>
                    </div>

                    <div className="careplans-tile-actions">
                      <button type="button" className="header-chip-btn careplans-link" onClick={() => downloadTemplate(t)}>
                        Download
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

                      {t.source === "local-custom" ? (
                        <button
                          type="button"
                          className="header-chip-btn"
                          onClick={() => syncCustomTemplate(t)}
                          disabled={templateSyncingId === String(t.id)}
                        >
                          {templateSyncingId === String(t.id) ? "Syncing..." : "Sync to Medplum"}
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>

      <section className="patient-card careplans-card-outline">
        <button
          type="button"
          className={"careplans-folder-head" + (exercisesOpen ? " is-open" : "")}
          onClick={() => setExercisesOpen((v) => !v)}
        >
          <span className="careplans-folder-title">Exercise Library</span>
          <span className="careplans-folder-meta">{filteredExercises.length}</span>
          <span className="careplans-folder-caret" aria-hidden="true">
            ▾
          </span>
        </button>

        {exercisesOpen ? (
          <div className="careplans-folder-body">
            <div className="careplans-ex-toolbar">
              <input
                className="inline-input careplans-ex-search"
                value={exerciseQuery}
                onChange={(e) => setExerciseQuery(e.target.value)}
                placeholder="Search exercises by name or tag..."
              />

              <div className="careplans-ex-actions">
                <button
                  type="button"
                  className={"header-chip-btn" + (showArchivedExercises ? " careplans-chip-active" : "")}
                  onClick={() => setShowArchivedExercises((v) => !v)}
                >
                  Archived
                </button>

                <button type="button" className="header-chip-btn" onClick={openNewExercise}>
                  New exercise
                </button>
              </div>
            </div>

            {exercisesLoading ? (
              <div className="careplans-empty">Loading exercises...</div>
            ) : exercisesError ? (
              <div className="careplans-empty">{exercisesError}</div>
            ) : filteredExercises.length === 0 ? (
              <div className="careplans-empty">No exercises yet.</div>
            ) : (
              <div className="careplans-ex-groups">
                {exerciseGroups.map((g) => (
                  <div className="careplans-ex-group" key={g.key}>
                    <div className="careplans-ex-group-title">{g.key}</div>

                    <div className="careplans-ex-list">
                      {g.items.map((ex) => (
                        <div className={"careplans-ex-row" + (ex.archived ? " is-archived" : "")} key={ex.id}>
                          <div className="careplans-ex-main">
                            <div className="careplans-ex-name">{ex.name}</div>
                            <div className="careplans-ex-meta">
                              <span className="careplans-ex-pill">{ex.scope === "user" ? "My" : "Global"}</span>
                              {Array.isArray(ex.tags) && ex.tags.length > 0 ? (
                                <span className="careplans-ex-tags">{ex.tags.join(", ")}</span>
                              ) : (
                                <span className="careplans-ex-tags">—</span>
                              )}
                            </div>
                          </div>

                          <div className="careplans-ex-row-actions">
                            <button type="button" className="header-chip-btn" onClick={() => openEditExercise(ex)}>
                              Edit
                            </button>

                            {!ex.archived ? (
                              <button type="button" className="header-chip-btn" onClick={() => archiveExercise(ex)}>
                                Archive
                              </button>
                            ) : (
                              <button type="button" className="header-chip-btn" onClick={() => restoreExercise(ex)}>
                                Restore
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}
      </section>

      {templateEditorOpen ? (
        <div
          className="careplans-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeTemplateEditor();
          }}
        >
          <div className="careplans-modal careplans-card-outline">
            <div className="careplans-modal-header">
              <div className="careplans-modal-title">{templateEditorMode === "edit" ? "Edit template" : "New template"}</div>
              <button type="button" className="careplans-modal-close" onClick={closeTemplateEditor}>
                ✕
              </button>
            </div>

            <div className="careplans-modal-body">
              <div className="careplans-field">
                <div className="careplans-label">Title</div>
                <input
                  className="inline-input"
                  value={templateEditorTitle}
                  onChange={(e) => setTemplateEditorTitle(e.target.value)}
                  placeholder="Template title..."
                />
              </div>

              <div className="careplans-field">
                <div className="careplans-label">Selected exercises</div>

                {templateSelected.length === 0 ? (
                  <div className="careplans-empty">No exercises selected yet.</div>
                ) : (
                  <div className="careplans-selected-list">
                    {templateSelected.map((x) => (
                      <div className="careplans-selected-row" key={x.name}>
                        <div className="careplans-selected-main">
                          <div className="careplans-selected-name">{x.name}</div>
                          <div className="careplans-selected-meta">
                            {Array.isArray(x.tags) && x.tags.length > 0 ? x.tags.join(", ") : "—"}
                          </div>
                        </div>
                        <button type="button" className="header-chip-btn" onClick={() => removeExerciseFromTemplate(x.name)}>
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="careplans-field">
                <div className="careplans-label">Add exercises from library</div>
                <input
                  className="inline-input"
                  value={templatePickerQuery}
                  onChange={(e) => setTemplatePickerQuery(e.target.value)}
                  placeholder="Search exercises..."
                />

                <div className="careplans-picker-list">
                  {pickerResults.map((ex) => {
                    const already = templateSelected.some(
                      (t) => String(t.name).toLowerCase() === String(ex.name || "").toLowerCase()
                    );
                    return (
                      <div className="careplans-picker-row" key={ex.id}>
                        <div className="careplans-picker-main">
                          <div className="careplans-picker-name">{ex.name}</div>
                          <div className="careplans-picker-meta">
                            {Array.isArray(ex.tags) && ex.tags.length > 0 ? ex.tags.join(", ") : "—"}
                          </div>
                        </div>
                        <button
                          type="button"
                          className={"header-chip-btn" + (already ? " careplans-chip-disabled" : "")}
                          onClick={() => addExerciseToTemplate(ex)}
                          disabled={already}
                        >
                          {already ? "Added" : "Add"}
                        </button>
                      </div>
                    );
                  })}
                </div>

                {templateEditorError ? <div className="careplans-empty">{templateEditorError}</div> : null}
              </div>

              <div className="careplans-modal-actions">
                <button type="button" className="header-chip-btn" onClick={closeTemplateEditor}>
                  Cancel
                </button>
                <button type="button" className="header-chip-btn" onClick={saveTemplateEditor}>
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {exerciseEditorOpen ? (
        <div
          className="careplans-modal-overlay"
          role="dialog"
          aria-modal="true"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeExerciseEditor();
          }}
        >
          <div className="careplans-modal careplans-card-outline">
            <div className="careplans-modal-header">
              <div className="careplans-modal-title">{exerciseEditorMode === "edit" ? "Edit exercise" : "New exercise"}</div>
              <button type="button" className="careplans-modal-close" onClick={closeExerciseEditor}>
                ✕
              </button>
            </div>

            <div className="careplans-modal-body">
              <div className="careplans-field">
                <div className="careplans-label">Name</div>
                <input className="inline-input" value={exerciseName} onChange={(e) => setExerciseName(e.target.value)} />
              </div>

              <div className="careplans-field">
                <div className="careplans-label">Instructions</div>
                <textarea
                  className="inline-input careplans-textarea"
                  value={exerciseInstructions}
                  onChange={(e) => setExerciseInstructions(e.target.value)}
                />
              </div>

              <div className="careplans-field">
                <div className="careplans-label">Tags (comma separated)</div>
                <input
                  className="inline-input"
                  value={exerciseTags}
                  onChange={(e) => setExerciseTags(e.target.value)}
                  placeholder="knee, rehab, strength"
                />
              </div>

              <div className="careplans-field">
                <div className="careplans-label">Scope</div>
                <select className="inline-input" value={exerciseScope} onChange={(e) => setExerciseScope(e.target.value)}>
                  <option value="global">Global</option>
                  <option value="user">My</option>
                </select>
              </div>

              {exerciseEditorError ? <div className="careplans-empty">{exerciseEditorError}</div> : null}

              <div className="careplans-modal-actions">
                <button type="button" className="header-chip-btn" onClick={closeExerciseEditor}>
                  Cancel
                </button>
                <button type="button" className="header-chip-btn" onClick={saveExerciseEditor}>
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
