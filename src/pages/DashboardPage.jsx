// src/pages/DashboardPage.jsx
import "./DashboardPage.css";

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
      <path d="M11 3.1c-.4.1-.7.4-.8.8l-.3 1.4c-.3.1-.7.3-1 .5l-1.4-.4a1 1 0 0 0-1 .3L4.6 7.1a1 1 0 0 0-.2 1l.6 1.3c-.1.3-.2.7-.2 1.1s.1.8.2 1.1l-.6 1.3a1 1 0 0 0 .2 1l1.5 1.5a1 1 0 0 0 1 .3l1.4-.4c.3.2.7.4 1 .5l.3 1.4c.1.4.4.7.8.8h2.1c.4-.1.7-.4.8-.8l.3-1.4c.3-.1.7-.3 1-.5l1.4.4a1 1 0 0 0 1-.3l1.5-1.5a1 1 0 0 0 .2-1l-.6-1.3c.1-.3.2-.7.2-1.1s-.1-.8-.2-1.1l.6-1.3a1 1 0 0 0-.2-1l-1.5-1.5a1 1 0 0 0-1-.3l-1.4.4c-.3-.2-.7-.4-1-.5-.1-.5-.2-1-.3-1.4a1 1 0 0 0-.8-.8H11Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  );
}

function DashboardPage({ patients = [] }) {
  const totalPatients = patients.length;

  const activeCases = patients.filter((p) => {
    const status = (p.status || "").toLowerCase();
    return status === "active" || status === "ongoing";
  }).length;

  const recoveredCases = patients.filter((p) => {
    const status = (p.status || "").toLowerCase();
    return status === "recovered" || status === "discharged";
  }).length;

  const recoveryRate =
    totalPatients > 0
      ? Math.round((recoveredCases / totalPatients) * 100)
      : 0;

  const conditionCounts = {};
  patients.forEach((p) => {
    let conditions = [];

    if (Array.isArray(p.conditions)) {
      conditions = p.conditions;
    } else if (typeof p.issues === "string") {
      conditions = p.issues.split(",").map((s) => s.trim());
    }

    conditions.forEach((c) => {
      if (!c) return;
      const key = c.toLowerCase();
      conditionCounts[key] = (conditionCounts[key] || 0) + 1;
    });
  });

  const conditionEntries = Object.entries(conditionCounts).sort(
    (a, b) => b[1] - a[1]
  );

  return (
    <div className="dashboard-page">
      <div className="dashboard-main">
        <div className="dashboard-topbar">
          <div className="topbar-left">
            <span className="topbar-title">
              MedicalCare - Patient &amp; Treatment Manager
            </span>
          </div>
          <div className="topbar-right">
            <button
              type="button"
              className="topbar-icon-button"
              aria-label="Notifications"
            >
              <BellIcon />
            </button>
            <button
              type="button"
              className="topbar-icon-button"
              aria-label="Settings"
            >
              <SettingsIcon />
            </button>
          </div>
        </div>

        <header className="dashboard-header">
          <div className="dashboard-header-text">
            <p className="dashboard-welcome">Welcome back</p>
            <h1 className="dashboard-title">MedicalCare Dashboard</h1>
          </div>
        </header>

        <section className="dashboard-cards-row">
          <article className="stat-card">
            <div className="stat-card-label">Total Patients</div>
            <div className="stat-card-value">{totalPatients}</div>
            <div className="stat-card-footer">All registered patients</div>
          </article>

          <article className="stat-card">
            <div className="stat-card-label">Active Cases</div>
            <div className="stat-card-value">{activeCases}</div>
            <div className="stat-card-footer">Currently under treatment</div>
          </article>

          <article className="stat-card">
            <div className="stat-card-label">Recovery Rate</div>
            <div className="stat-card-value">
              {recoveryRate}
              <span className="stat-card-unit">%</span>
            </div>
            <div className="stat-card-footer">Based on recovered cases</div>
          </article>

          <article className="stat-card">
            <div className="stat-card-label">Consultations</div>
            <div className="stat-card-value">0</div>
            <div className="stat-card-footer">Completed sessions</div>
          </article>
        </section>

        <section className="dashboard-split-row">
          <article className="panel-card">
            <div className="panel-header">
              <h2 className="panel-title">Conditions Distribution</h2>
            </div>
            <div className="panel-body">
              {conditionEntries.length === 0 ? (
                <p className="panel-empty">
                  No condition data yet. Add patients with conditions to see
                  distribution.
                </p>
              ) : (
                <ul className="distribution-list">
                  {conditionEntries.map(([name, count]) => (
                    <li key={name} className="distribution-item">
                      <span className="distribution-name">
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                      </span>
                      <span className="distribution-bar-wrap">
                        <span
                          className="distribution-bar"
                          style={{
                            width:
                              totalPatients > 0
                                ? `${Math.round(
                                    (count / totalPatients) * 100
                                  )}%`
                                : "0%",
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
              <h2 className="panel-title">Clinical Status Distribution</h2>
            </div>
            <div className="panel-body">
              <p className="panel-empty">
                Status charts can be added here later (Stable, Active, High
                risk).
              </p>
            </div>
          </article>
        </section>

        <section className="dashboard-features-row">
          <article className="feature-card">
            <div className="feature-icon">📅</div>
            <h3 className="feature-title">Treatment Calendar</h3>
            <p className="feature-text">
              Schedule and track upcoming treatment sessions in a dedicated
              calendar.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">📄</div>
            <h3 className="feature-title">Treatment Summary PDF</h3>
            <p className="feature-text">
              Generate professional PDF summaries combining notes and plans.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">🧩</div>
            <h3 className="feature-title">Care Plan Builder</h3>
            <p className="feature-text">
              Build structured care plans with goals, exercises and schedules.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">🎙️</div>
            <h3 className="feature-title">Treatment Transcriptions</h3>
            <p className="feature-text">
              Record and transcribe sessions for accurate clinical
              documentation.
            </p>
          </article>
        </section>
      </div>
    </div>
  );
}

export default DashboardPage;
