// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  Stethoscope,
  Users,
  FileText,
  Pill,
  ClipboardList,
  CalendarDays,
  BarChart2,
  Shield,
  Link2,
  Settings,
} from "lucide-react";
import "./Sidebar.css";

function Sidebar({ language = "en" }) {
  const isHebrew = language === "he";

  const labels = isHebrew
    ? {
        dashboard: "דשבורד",
        patients: "מטופלים",
        users: "משתמשים",
        data: "נתונים",
        dataPatient: "מידע מטופל",
        dataTreatment: "מידע טיפול",
        dataCarePlan: "תוכניות טיפול",
        dataAppointment: "תורים",
        system: "מערכת",
        analytics: "סטטיסטיקות",
        security: "אבטחה",
        api: "API",
        settings: "הגדרות",
        subtitle: "ניהול טיפולים",
      }
    : {
        dashboard: "Dashboard",
        patients: "Patients",
        users: "Users",
        data: "Data",
        dataPatient: "Patient data",
        dataTreatment: "Treatment data",
        dataCarePlan: "Care plans",
        dataAppointment: "Appointments",
        system: "System",
        analytics: "Analytics",
        security: "Security",
        api: "API",
        settings: "Settings",
        subtitle: "Treatment management",
      };

  return (
    <aside className={`app-sidebar ${isHebrew ? "sidebar-rtl" : "sidebar-ltr"}`}>
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo">
          <img src="/icon.png" alt="MedicalCare logo" className="sidebar-brand-logo-img" />
        </div>
        <div className="sidebar-brand-text">
          <div className="sidebar-brand-title">MedicalCare</div>
          <div className="sidebar-brand-subtitle">{labels.subtitle}</div>
        </div>
      </div>

      <nav className="sidebar-nav">
        <NavLink
          to="/dashboard"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <LayoutDashboard size={18} />
          </span>
          <span className="sidebar-link-label">{labels.dashboard}</span>
        </NavLink>

        <NavLink
          to="/patients"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <Stethoscope size={18} />
          </span>
          <span className="sidebar-link-label">{labels.patients}</span>
        </NavLink>

        <NavLink
          to="/users"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <Users size={18} />
          </span>
          <span className="sidebar-link-label">{labels.users}</span>
        </NavLink>

        <div className="sidebar-section-title">{labels.data}</div>

        <NavLink
          to="/data/patient"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <FileText size={18} />
          </span>
          <span className="sidebar-link-label">{labels.dataPatient}</span>
        </NavLink>

        <NavLink
          to="/data/treatment"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <Pill size={18} />
          </span>
          <span className="sidebar-link-label">{labels.dataTreatment}</span>
        </NavLink>

        <NavLink
          to="/data/care-plan"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <ClipboardList size={18} />
          </span>
          <span className="sidebar-link-label">{labels.dataCarePlan}</span>
        </NavLink>

        <NavLink
          to="/data/appointment"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <CalendarDays size={18} />
          </span>
          <span className="sidebar-link-label">{labels.dataAppointment}</span>
        </NavLink>

        <div className="sidebar-section-title">{labels.system}</div>

        <NavLink
          to="/analytics"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <BarChart2 size={18} />
          </span>
          <span className="sidebar-link-label">{labels.analytics}</span>
        </NavLink>

        <NavLink
          to="/security"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <Shield size={18} />
          </span>
          <span className="sidebar-link-label">{labels.security}</span>
        </NavLink>

        <NavLink
          to="/api"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <Link2 size={18} />
          </span>
          <span className="sidebar-link-label">{labels.api}</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            "sidebar-link" + (isActive ? " sidebar-link-active" : "")
          }
        >
          <span className="sidebar-link-icon">
            <Settings size={18} />
          </span>
          <span className="sidebar-link-label">{labels.settings}</span>
        </NavLink>
      </nav>
    </aside>
  );
}

export default Sidebar;
