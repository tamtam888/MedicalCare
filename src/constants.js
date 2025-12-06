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
  { id: "dashboard", labelKey: "menuDashboard", icon: LayoutDashboard },
  { id: "patients", labelKey: "menuPatients", icon: Users },
  { id: "treatments", labelKey: "menuTreatments", icon: Activity },
  { id: "calendar", labelKey: "menuCalendar", icon: Calendar },
  { id: "reports", labelKey: "menuReports", icon: FileText },
  { id: "settings", labelKey: "menuSettings", icon: Settings },
];

export const TRANSLATIONS = {
  en: {
    appName: "MedicalCare",
    menuDashboard: "Dashboard",
    menuPatients: "Patients",
    menuTreatments: "Treatments",
    menuCalendar: "Calendar",
    menuReports: "Reports",
    menuSettings: "Settings",
  },
  he: {
    appName: "MedicalCare",
    menuDashboard: "לוח בקרה",
    menuPatients: "מטופלים",
    menuTreatments: "טיפולים",
    menuCalendar: "יומן",
    menuReports: "דוחות",
    menuSettings: "הגדרות",
  },
};
