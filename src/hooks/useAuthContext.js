import { useCallback, useEffect, useMemo, useState } from "react";

const ROLE_KEY = "mc_role";
const THERAPIST_ID_KEY = "mc_therapistId";
const ADMIN_FILTER_KEY = "mc_adminTherapistFilter";

function read(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v == null ? fallback : v;
  } catch {
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // ignore
  }
}

export function useAuthContext() {
  const [role, setRoleState] = useState(() => read(ROLE_KEY, "therapist"));
  const [therapistId, setTherapistIdState] = useState(() => read(THERAPIST_ID_KEY, "local-therapist"));
  const [adminTherapistFilter, setAdminTherapistFilterState] = useState(() => read(ADMIN_FILTER_KEY, "all"));

  useEffect(() => write(ROLE_KEY, role), [role]);
  useEffect(() => write(THERAPIST_ID_KEY, therapistId), [therapistId]);
  useEffect(() => write(ADMIN_FILTER_KEY, adminTherapistFilter), [adminTherapistFilter]);

  const isAdmin = useMemo(() => String(role).toLowerCase() === "admin", [role]);

  const setRole = useCallback((nextRole) => {
    const r = String(nextRole || "therapist").toLowerCase();
    setRoleState(r);

    if (r !== "admin") {
      setAdminTherapistFilterState("all");
      if (!read(THERAPIST_ID_KEY, "")) setTherapistIdState("local-therapist");
    }
  }, []);

  const setTherapistId = useCallback((nextId) => {
    setTherapistIdState(String(nextId || "local-therapist").trim() || "local-therapist");
  }, []);

  const setAdminTherapistFilter = useCallback((next) => {
    setAdminTherapistFilterState(String(next || "all"));
  }, []);

  return {
    role,
    therapistId,
    isAdmin,
    adminTherapistFilter,
    setRole,
    setTherapistId,
    setAdminTherapistFilter,
  };
}
