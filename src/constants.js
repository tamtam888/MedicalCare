// src/constants.js
import {
  LayoutDashboard,
  Users,
  Activity,
  Calendar,
  FileText,
  Settings,
} from "lucide-react";

export const MENU_ITEMS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "patients", label: "Patients", icon: Users },
  { id: "treatments", label: "Treatments", icon: Activity },
  { id: "calendar", label: "Calendar", icon: Calendar },
  { id: "reports", label: "Reports", icon: FileText },
  { id: "settings", label: "Settings", icon: Settings },
];

// API Configuration
export const IMPROVE_API_URL =
  import.meta.env.VITE_IMPROVE_API_URL ||
  "http://localhost:5000/api/improve-note";
