import { useCallback, useEffect, useState } from "react";
import {
  createAppointment,
  getAllAppointments,
  deleteAppointment as deleteAppointmentFromStore,
  updateAppointment as updateAppointmentInStore,
} from "./appointmentsStore";

export function useAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const all = await getAllAppointments();
    setAppointments(all);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      try {
        await refresh();
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    init();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const addAppointment = useCallback(async (input) => {
    const created = await createAppointment(input);
    await refresh();
    return created;
  }, [refresh]);

  const updateAppointment = useCallback(async (id, patch) => {
    const updated = await updateAppointmentInStore(id, patch);
    await refresh();
    return updated;
  }, [refresh]);

  const deleteAppointment = useCallback(async (id) => {
    await deleteAppointmentFromStore(id);
    await refresh();
    return true;
  }, [refresh]);

  return {
    appointments,
    loading,
    refresh,
    addAppointment,
    updateAppointment,
    deleteAppointment,
  };
}
