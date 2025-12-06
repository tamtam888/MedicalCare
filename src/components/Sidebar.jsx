// src/components/Sidebar.jsx
import { NavLink } from "react-router-dom";
import "./Sidebar.css";

const navItems = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/patients", label: "Patients" },
  { to: "/data/patient", label: "Patient data" },
  { to: "/data/treatment", label: "Treatment data" },
  { to: "/data/care-plan", label: "Care plans" },
  { to: "/data/appointment", label: "Appointments" },
  { to: "/users", label: "Users" },
  { to: "/analytics", label: "Analytics" },
  { to: "/security", label: "Security" },
  { to: "/api", label: "API" },
  { to: "/settings", label: "Settings" },
];

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">MedicalCare</div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              "sidebar-link" + (isActive ? " sidebar-link-active" : "")
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}

export default Sidebar;
