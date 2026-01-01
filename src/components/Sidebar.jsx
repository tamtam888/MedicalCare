<<<<<<< HEAD
=======
// src/components/Sidebar.jsx
>>>>>>> refactor-ui-cleanup
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Stethoscope,
<<<<<<< HEAD
=======
  Pill,
>>>>>>> refactor-ui-cleanup
  ClipboardList,
  CalendarDays,
  BarChart2,
  Shield,
  Link2,
} from "lucide-react";
import "./Sidebar.css";

function Sidebar() {
  return (
    <aside className="app-sidebar sidebar-ltr">
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
<<<<<<< HEAD
          <img src="/icon.png" alt="MedicalCare logo" className="sidebar-brand-logo-img" />
=======
          <img
            src="/icon.png"
            alt="MedicalCare logo"
            className="sidebar-brand-logo-img"
          />
>>>>>>> refactor-ui-cleanup
        </div>

        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">MedicalCare</div>
          <div className="sidebar-brand-subtitle">Treatment management</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/dashboard"
<<<<<<< HEAD
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
=======
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
>>>>>>> refactor-ui-cleanup
        >
          <span className="sidebar-link-icon">
            <LayoutDashboard size={18} />
          </span>
          <span className="sidebar-link-label">Dashboard</span>
        </NavLink>

        <NavLink
          to="/patients"
<<<<<<< HEAD
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
=======
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
>>>>>>> refactor-ui-cleanup
        >
          <span className="sidebar-link-icon">
            <Stethoscope size={18} />
          </span>
          <span className="sidebar-link-label">Patients</span>
        </NavLink>

        <div className="sidebar-section-title">Data</div>

        <NavLink
<<<<<<< HEAD
          to="/data/care-plan"
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
=======
          to="/data/treatment"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <Pill size={18} />
          </span>
          <span className="sidebar-link-label">Treatment data</span>
        </NavLink>

        <NavLink
          to="/data/care-plan"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
>>>>>>> refactor-ui-cleanup
        >
          <span className="sidebar-link-icon">
            <ClipboardList size={18} />
          </span>
          <span className="sidebar-link-label">Care plans</span>
        </NavLink>

        <NavLink
          to="/data/appointment"
<<<<<<< HEAD
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
=======
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
>>>>>>> refactor-ui-cleanup
        >
          <span className="sidebar-link-icon">
            <CalendarDays size={18} />
          </span>
          <span className="sidebar-link-label">Appointments</span>
        </NavLink>

        <div className="sidebar-section-title">System</div>

        <NavLink
          to="/analytics"
<<<<<<< HEAD
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
=======
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
>>>>>>> refactor-ui-cleanup
        >
          <span className="sidebar-link-icon">
            <BarChart2 size={18} />
          </span>
          <span className="sidebar-link-label">Analytics</span>
        </NavLink>

        <NavLink
          to="/security"
<<<<<<< HEAD
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
=======
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
>>>>>>> refactor-ui-cleanup
        >
          <span className="sidebar-link-icon">
            <Shield size={18} />
          </span>
          <span className="sidebar-link-label">Security</span>
        </NavLink>

        <NavLink
          to="/api"
<<<<<<< HEAD
          className={({ isActive }) => "sidebar-link" + (isActive ? " sidebar-link-active" : "")}
=======
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
>>>>>>> refactor-ui-cleanup
        >
          <span className="sidebar-link-icon">
            <Link2 size={18} />
          </span>
          <span className="sidebar-link-label">API</span>
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
