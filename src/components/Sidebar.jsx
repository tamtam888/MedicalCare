import { NavLink, useNavigate } from "react-router-dom";
import { LayoutDashboard, Stethoscope, ClipboardList, CalendarDays, Users, LogOut } from "lucide-react";
import { useAuthContext } from "../hooks/useAuthContext";
import "./Sidebar.css";

function normalize(value) {
  return String(value ?? "").trim();
}

function readDisplayNameFallback({ role, therapistId }) {
  try {
    const keys = ["mc_display_name", "mc_user_full_name", "mc_user_name", "mc_full_name"];
    for (const k of keys) {
      const v = localStorage.getItem(k);
      if (v && normalize(v)) return normalize(v);
    }
  } catch {
    // ignore
  }

  if (String(role || "").toLowerCase() === "admin") return "Admin";
  if (normalize(therapistId)) return normalize(therapistId);
  return "User";
}

function Sidebar() {
  const navigate = useNavigate();
  const { role, therapistId, isAdmin, setRole, setTherapistId } = useAuthContext();

  const displayName = readDisplayNameFallback({ role, therapistId });

  const handleSignOut = () => {
    try {
      localStorage.removeItem("mc_logged_in");
    } catch {
      // ignore
    }

    setRole("therapist");
    setTherapistId("local-therapist");

    navigate("/login", { replace: true });
  };

  return (
    <aside className="app-sidebar sidebar-ltr">
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <img src="/icon.png" alt="MedicalCare logo" className="sidebar-brand-logo-img" />
        </div>

        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">MedicalCare</div>
          <div className="sidebar-brand-subtitle">Treatment management</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/dashboard" className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}>
          <span className="sidebar-link-icon">
            <LayoutDashboard size={18} />
          </span>
          <span className="sidebar-link-label">Dashboard</span>
        </NavLink>

        <NavLink to="/patients" className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}>
          <span className="sidebar-link-icon">
            <Stethoscope size={18} />
          </span>
          <span className="sidebar-link-label">Patients</span>
        </NavLink>

        {isAdmin ? (
          <NavLink to="/users" className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}>
            <span className="sidebar-link-icon">
              <Users size={18} />
            </span>
            <span className="sidebar-link-label">Users</span>
          </NavLink>
        ) : null}

        <div className="sidebar-section-title">Data</div>

        <NavLink
          to="/data/care-plan"
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
        >
          <span className="sidebar-link-icon">
            <ClipboardList size={18} />
          </span>
          <span className="sidebar-link-label">Care plans</span>
        </NavLink>

        <NavLink
          to="/data/appointment"
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
        >
          <span className="sidebar-link-icon">
            <CalendarDays size={18} />
          </span>
          <span className="sidebar-link-label">Appointments</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-user-name">{displayName}</div>
          <div className="sidebar-user-role">{isAdmin ? "Admin" : "Therapist"}</div>
        </div>

        <button type="button" className="sidebar-logout" onClick={handleSignOut}>
          <span className="sidebar-logout-icon">
            <LogOut size={18} />
          </span>
          <span className="sidebar-logout-label">Sign out</span>
        </button>
      </div>
    </aside>
  );
}

export default Sidebar;
