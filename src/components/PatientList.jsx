import "./PatientList.css";
import { Clock, Pencil, Trash2, MapPin } from "lucide-react";

function getInitials(firstName, lastName) {
  const first = (firstName || "").trim();
  const last = (lastName || "").trim();
  if (!first && !last) return "PT";
  const f = first ? first[0] : "";
  const l = last ? last[0] : "";
  return (f + l || "PT").toUpperCase();
}

function normalizeConditions(conditions) {
  if (!conditions) return [];
  if (Array.isArray(conditions)) return conditions;
  if (typeof conditions === "string") {
    return conditions
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
  }
  return [];
}

function getStatusClass(status) {
  if (!status) return "patient-status-pill patient-status-active";

  const s = String(status).toLowerCase().trim();

  if (s === "active") return "patient-status-pill patient-status-active";
  if (s === "stable") return "patient-status-pill patient-status-stable";
  if (s === "inactive") return "patient-status-pill patient-status-inactive";
  if (s === "disable" || s === "disabled")
    return "patient-status-pill patient-status-disabled";
  if (s === "not active" || s === "not-active" || s === "notactive")
    return "patient-status-pill patient-status-not-active";

  return "patient-status-pill";
}

function getGenderClass(g) {
  if (!g) return "patient-avatar-other";
  const s = String(g).toLowerCase();
  if (s === "female") return "patient-avatar-female";
  if (s === "male") return "patient-avatar-male";
  return "patient-avatar-other";
}

function PatientList({ patients = [], onEditPatient, onDeletePatient, onViewPatient }) {
  return (
    <div className="patient-list-card">
      <div className="patient-list-header-row">
        <div className="patient-header-cell patient-header-name">NAME / ID</div>
        <div className="patient-header-cell">STATUS</div>
        <div className="patient-header-cell">CONDITIONS</div>
        <div className="patient-header-cell">LOCATION</div>
        <div className="patient-header-cell patient-header-actions">ACTIONS</div>
      </div>

      <div className="patient-list-body">
        {patients.map((p) => {
          const idValue = p.idNumber || p.id || "";
          const status = p.status || p.clinicalStatus || "Active";
          const city = p.city || p.location || "";
          const conditions = normalizeConditions(p.conditions);

          return (
            <div className="patient-row" key={idValue || `${p.firstName}-${p.lastName}`}>
              <div className="patient-cell patient-cell-name">
                <div className={`patient-avatar ${getGenderClass(p.gender)}`}>
                  {getInitials(p.firstName, p.lastName)}
                </div>

                <div className="patient-name-block">
                  <div className="patient-name">
                    {(p.firstName || "") + " " + (p.lastName || "")}
                  </div>
                  <div className="patient-id">ID: {idValue}</div>
                </div>
              </div>

              <div className="patient-cell">
                <span className={getStatusClass(status)}>{status}</span>
              </div>

              <div className="patient-cell patient-cell-conditions">
                {conditions.length === 0 ? (
                  <span className="patient-conditions-empty">-</span>
                ) : (
                  conditions.map((c) => (
                    <span className="patient-condition-pill" key={c}>
                      {c}
                    </span>
                  ))
                )}
              </div>

              <div className="patient-cell patient-cell-location">
                {city ? (
                  <>
                    <span className="patient-location-icon">
                      <MapPin size={14} />
                    </span>
                    <span>{city}</span>
                  </>
                ) : (
                  <span className="patient-conditions-empty">-</span>
                )}
              </div>

              <div className="patient-cell patient-cell-actions">
                <div className="action-tooltip-wrapper">
                  <button
                    type="button"
                    className="patient-action-btn"
                    onClick={onViewPatient ? () => onViewPatient(p) : undefined}
                  >
                    <Clock size={14} />
                  </button>
                  <span className="action-tooltip">View History</span>
                </div>

                <div className="action-tooltip-wrapper">
                  <button
                    type="button"
                    className="patient-action-btn"
                    onClick={onEditPatient ? () => onEditPatient(p) : undefined}
                  >
                    <Pencil size={14} />
                  </button>
                  <span className="action-tooltip">Edit</span>
                </div>

                <div className="action-tooltip-wrapper">
                  <button
                    type="button"
                    className="patient-action-btn patient-action-danger"
                    onClick={onDeletePatient ? () => onDeletePatient(p) : undefined}
                  >
                    <Trash2 size={14} />
                  </button>
                  <span className="action-tooltip">Delete</span>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PatientList;
