import React, { useMemo, useState } from "react";
import "./CarePlanGoals.css";
import { formatDateDMY, fromISODateInput, toISODateInput } from "../utils/dateFormat";

function createId(prefix) {
  const id = globalThis.crypto?.randomUUID?.();
  return id ? `${prefix}_${id}` : `${prefix}_${Date.now()}`;
}

const emptyDraft = {
  title: "",
  status: "Planned",
  targetDate: "",
  notes: "",
};

export default function CarePlanGoals({ value = [], onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);

  const isEditing = Boolean(editingId);

  const sorted = useMemo(() => {
    const arr = Array.isArray(value) ? value : [];
    return [...arr].sort((a, b) => String(a?.targetDate || "").localeCompare(String(b?.targetDate || "")));
  }, [value]);

  function openAdd() {
    setEditingId(null);
    setDraft(emptyDraft);
    setIsOpen(true);
  }

  function openEdit(g) {
    setEditingId(g.id);
    setDraft({
      title: g.title || "",
      status: g.status || "Planned",
      targetDate: g.targetDate ? toISODateInput(g.targetDate) : "",
      notes: g.notes || "",
    });
    setIsOpen(true);
  }

  function close() {
    setIsOpen(false);
    setEditingId(null);
    setDraft(emptyDraft);
  }

  function remove(id) {
    const next = (value || []).filter((x) => x?.id !== id);
    onChange(next);
  }

  function validate(d) {
    if (!String(d.title || "").trim()) return "Goal title is required.";
    return null;
  }

  function save() {
    const err = validate(draft);
    if (err) {
      alert(err);
      return;
    }

    const payload = {
      title: String(draft.title || "").trim(),
      status: String(draft.status || "Planned"),
      targetDate: draft.targetDate ? fromISODateInput(draft.targetDate) : undefined,
      notes: String(draft.notes || ""),
    };

    if (isEditing) {
      const next = (value || []).map((x) => (x?.id === editingId ? { ...x, ...payload } : x));
      onChange(next);
      close();
      return;
    }

    onChange([
      ...(value || []),
      {
        id: createId("goal"),
        ...payload,
      },
    ]);
    close();
  }

  return (
    <div className="careplan-goals">
      <div className="careplan-goals-header">
        <div className="careplan-goals-title">Therapy goals</div>
        <button type="button" className="header-chip-btn" onClick={openAdd}>
          + Add goal
        </button>
      </div>

      {sorted.length === 0 ? (
        <div className="careplan-goals-empty">No goals yet.</div>
      ) : (
        <div className="careplan-goals-list">
          {sorted.map((g) => {
            const td = g.targetDate ? formatDateDMY(g.targetDate) : "";
            return (
              <div className="careplan-goal-item" key={g.id}>
                <div className="careplan-goal-main">
                  <div className="careplan-goal-title">{g.title}</div>
                  <div className="careplan-goal-meta">
                    <span className="careplan-goal-pill">{g.status || "Planned"}</span>
                    <span className="careplan-goal-pill">
                      <strong>Target:</strong>{" "}
                      <bdi dir="ltr">{td || "—"}</bdi>
                    </span>
                  </div>
                  {g.notes ? <div className="careplan-goal-notes">{g.notes}</div> : null}
                </div>

                <div className="careplan-goal-actions">
                  <button type="button" className="careplan-goal-btn" onClick={() => openEdit(g)}>
                    Edit
                  </button>
                  <button type="button" className="careplan-goal-btn careplan-goal-danger" onClick={() => remove(g.id)}>
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isOpen ? (
        <div className="careplan-goals-modal-overlay" role="dialog" aria-modal="true" onMouseDown={(e) => {
          if (e.target === e.currentTarget) close();
        }}>
          <div className="careplan-goals-modal">
            <div className="careplan-goals-modal-header">
              <div className="careplan-goals-modal-title">{isEditing ? "Edit goal" : "Add goal"}</div>
              <button type="button" className="careplan-goals-modal-close" onClick={close}>
                ✕
              </button>
            </div>

            <div className="careplan-goals-form">
              <label className="careplan-goals-field">
                <span className="careplan-goals-label">Title *</span>
                <input
                  className="inline-input"
                  value={draft.title}
                  onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                  placeholder="e.g. Improve stair climbing tolerance"
                />
              </label>

              <label className="careplan-goals-field">
                <span className="careplan-goals-label">Status</span>
                <select
                  className="inline-input"
                  value={draft.status}
                  onChange={(e) => setDraft((d) => ({ ...d, status: e.target.value }))}
                >
                  <option value="Planned">Planned</option>
                  <option value="In progress">In progress</option>
                  <option value="Achieved">Achieved</option>
                  <option value="On hold">On hold</option>
                </select>
              </label>

              <label className="careplan-goals-field">
                <span className="careplan-goals-label">Target date</span>
                <input
                  className="inline-input"
                  type="date"
                  value={draft.targetDate}
                  onChange={(e) => setDraft((d) => ({ ...d, targetDate: e.target.value }))}
                />
              </label>

              <label className="careplan-goals-field">
                <span className="careplan-goals-label">Notes</span>
                <textarea
                  className="careplan-goals-textarea"
                  rows={3}
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </label>

              <div className="careplan-goals-actions-row">
                <button type="button" className="header-chip-btn" onClick={close}>
                  Cancel
                </button>
                <button type="button" className="header-chip-btn" onClick={save}>
                  {isEditing ? "Save changes" : "Add"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
