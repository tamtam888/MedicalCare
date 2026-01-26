import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./DashboardPage.css";
import { useAuthContext } from "../hooks/useAuthContext";

function BellIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3a5 5 0 0 0-5 5v2.6c0 .6-.2 1.2-.5 1.7L5 14.7c-.6 1-.1 2.3 1 2.7.3.1.6.2 1 .2h10c1.1 0 2-.9 2-2 0-.3-.1-.7-.3-1l-1.5-2.4c-.3-.5-.4-1-.4-1.6V8a5 5 0 0 0-5-5Z" />
      <path d="M9.8 19a2.2 2.2 0 0 0 4.4 0Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="icon-svg" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M11 3.1c-.4.1-.7.4-.8.8l-.3 1.4c-.3.1-.7.3-1 .5l-1.4-.4a1 1 0 0 0-1 .3L4.6 7.1a1 1 0 0 0-.2 1l.6 1.3c-.1.3-.2.7-.2 1.1s.1.8.2 1.1l-.6 1.3a1 1 0 0 0 .2 1l1.5 1.5a1 1 0 0 0 1 .3l1.4-.4c.3.2.7.4 1 .5l.3 1.4c.1.4.4.7.8.8h2.1c.4-.1.7-.4.8-.8l.3-1.4c.3-.1.7-.3 1-.5l1.4.4a1 1 0 0 0 1-.3l1.5-1.5a1 1 0 0 0 .2-1l-.6-1.3c.1-.3.2-.7.2-1.1s-.1-.8-.2-1.1l.6-1.3a1 1 0 0 0-.2-1l-1.5-1.5a1 1 0 0 0-1-.3l-1.4.4c-.3-.2-.7-.4-1-.5l-.3-1.4a1 1 0 0 0-.8-.8H11Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

const isActiveStatus = (value) => {
  const s = (value ?? "").toString().trim().toLowerCase();
  return (
    s === "active" ||
    s === "ongoing" ||
    s === "אקטיב" ||
    s === "פעיל" ||
    s.includes("אקטיב") ||
    s.includes("active")
  );
};

function DashboardPage({ patients = [] }) {
  const navigate = useNavigate();
  const { isAdmin } = useAuthContext();

  const totalPatients = patients.length;

  const activeCases = useMemo(() => {
    return patients.filter((p) => isActiveStatus(p?.status)).length;
  }, [patients]);

  const nonActiveCount = useMemo(() => {
    return patients.filter((p) => !isActiveStatus(p?.status)).length;
  }, [patients]);

  const conditionEntries = useMemo(() => {
    const conditionCounts = {};
    patients.forEach((p) => {
      let conditions = [];

      if (Array.isArray(p?.conditions)) {
        conditions = p.conditions;
      } else if (typeof p?.issues === "string") {
        conditions = p.issues.split(",").map((str) => str.trim());
      }

      conditions.forEach((c) => {
        if (!c) return;
        const key = c.toLowerCase();
        conditionCounts[key] = (conditionCounts[key] || 0) + 1;
      });
    });

    return Object.entries(conditionCounts).sort((a, b) => b[1] - a[1]);
  }, [patients]);

  const quickActions = useMemo(() => {
    const base = [
      {
        title: "Patients",
        subtitle: "View and manage patient records.",
        icon: "🧑‍⚕️",
        onClick: () => navigate("/patients"),
      },
      {
        title: "Treatment Calendar",
        subtitle: "Open the appointments calendar.",
        icon: "📅",
        onClick: () => navigate("/data/appointment"),
      },
      {
        title: "Care Plans",
        subtitle: "Manage care plans and exercises.",
        icon: "🧩",
        onClick: () => navigate("/data/care-plan"),
      },
    ];

    if (isAdmin) {
      base.push({
        title: "Users",
        subtitle: "Manage therapists and roles.",
        icon: "👥",
        onClick: () => navigate("/users"),
      });
    }

    return base;
  }, [isAdmin, navigate]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <div className="topbar-left">
            <span className="topbar-title">MedicalCare - Patient &amp; Treatment Manager</span>
          </div>
          <div className="topbar-right">
            <button type="button" className="topbar-icon-button" aria-label="Notifications">
              <BellIcon />
            </button>
            <button type="button" className="topbar-icon-button" aria-label="Settings">
              <SettingsIcon />
            </button>
          </div>
        </div>

        <header className="dashboard-header">
          <div className="dashboard-header-text">
            <p className="dashboard-welcome">Welcome back</p>
          </div>
        </header>

        <section className="dashboard-cards-row">
          <article className="stat-card">
            <div className="stat-card-label">Total Patients</div>
            <div className="stat-card-value">{totalPatients}</div>
            <div className="stat-card-footer">All registered patients</div>
          </article>

          <article className="stat-card">
            <div className="stat-card-label">Active</div>
            <div className="stat-card-value">{activeCases}</div>
            <div className="stat-card-footer">Currently under care</div>
          </article>

          <article className="stat-card">
            <div className="stat-card-label">Not Active</div>
            <div className="stat-card-value">{nonActiveCount}</div>
            <div className="stat-card-footer">Exception / needs review</div>
          </article>
        </section>

        <section className="dashboard-split-row">
          <article className="panel-card">
            <div className="panel-header">
              <h2 className="panel-title">Conditions Distribution</h2>
            </div>
            <div className="panel-body">
              {conditionEntries.length === 0 ? (
                <p className="panel-empty">No condition data yet. Add patients with conditions to see distribution.</p>
              ) : (
                <ul className="distribution-list">
                  {conditionEntries.map(([name, count]) => (
                    <li key={name} className="distribution-item">
                      <span className="distribution-name">
                        {String(name).charAt(0).toUpperCase() + String(name).slice(1)}
                      </span>
                      <span className="distribution-bar-wrap">
                        <span
                          className="distribution-bar"
                          style={{
                            width: totalPatients > 0 ? `${Math.round((count / totalPatients) * 100)}%` : "0%",
                          }}
                        />
                      </span>
                      <span className="distribution-count">
                        {count} / {totalPatients}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </article>

          <article className="panel-card">
            <div className="panel-header">
              <h2 className="panel-title">Quick Actions</h2>
            </div>
            <div className="panel-body">
              <div className="quick-actions-grid">
                {quickActions.map((a) => (
                  <button key={a.title} type="button" className="quick-action-card" onClick={a.onClick}>
                    <div className="quick-action-icon" aria-hidden="true">
                      {a.icon}
                    </div>
                    <div className="quick-action-title">{a.title}</div>
                    <div className="quick-action-subtitle">{a.subtitle}</div>
                  </button>
                ))}
              </div>
            </div>
          </article>
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;
