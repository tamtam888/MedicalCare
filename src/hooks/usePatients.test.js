import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, beforeEach } from "vitest";
import { usePatients } from "./usePatients";

const MAIN_KEY = "patients:main";
const BACKUP_KEY = "patients:backup";

function makeStorageMock() {
  const store = {};

  const getItem = (k) => (k in store ? store[k] : null);
  const setItem = (k, v) => {
    store[k] = String(v);
  };

  return {
    // Storage-style API
    getItem,
    setItem,
    removeItem: (k) => {
      delete store[k];
    },
    clear: () => {
      Object.keys(store).forEach((k) => delete store[k]);
    },

    // Async API (window.storage.get/set)
    get: async (k) => ({ value: getItem(k) }),
    set: async (k, v) => {
      setItem(k, v);
      return true;
    },
  };
}

describe("usePatients – storage resilience", () => {
  let storage;

  beforeEach(() => {
    storage = makeStorageMock();
    window.storage = storage;
    window.localStorage?.clear?.();
  });

  it("does not wipe storage on refresh (re-mount)", async () => {
    storage.setItem(
      MAIN_KEY,
      JSON.stringify([
        {
          idNumber: "123",
          firstName: "John",
          lastName: "Doe",
          history: [],
          reports: [],
        },
      ])
    );

    const first = renderHook(() => usePatients());
    await waitFor(() => {
      expect(first.result.current.patients).toHaveLength(1);
    });
    first.unmount();

    const second = renderHook(() => usePatients());
    await waitFor(() => {
      expect(second.result.current.patients).toHaveLength(1);
    });
  });

  it("does not overwrite existing data when deleting non-existing patient", async () => {
    storage.setItem(
      MAIN_KEY,
      JSON.stringify([
        {
          idNumber: "123",
          firstName: "John",
          lastName: "Doe",
          history: [],
          reports: [],
        },
      ])
    );

    const { result } = renderHook(() => usePatients());

    await waitFor(() => {
      expect(result.current.patients).toHaveLength(1);
    });

    await result.current.handleDeletePatient("999");

    const raw = storage.getItem(MAIN_KEY);
    expect(JSON.parse(raw)).toHaveLength(1);
  });

  it("falls back to backup storage when main is empty", async () => {
    storage.setItem(
      BACKUP_KEY,
      JSON.stringify([
        {
          idNumber: "123",
          firstName: "John",
          lastName: "Doe",
          history: [],
          reports: [],
        },
      ])
    );

    const { result } = renderHook(() => usePatients());

    await waitFor(() => {
      expect(result.current.patients).toHaveLength(1);
    });

    const restoredMain = storage.getItem(MAIN_KEY);
    expect(JSON.parse(restoredMain)).toHaveLength(1);
  });

  it("falls back to backup when main storage is corrupted and repairs main", async () => {
    // corrupted main
    storage.setItem(MAIN_KEY, "{ not valid json");

    // valid backup
    storage.setItem(
      BACKUP_KEY,
      JSON.stringify([
        {
          idNumber: "123",
          firstName: "John",
          lastName: "Doe",
          history: [],
          reports: [],
        },
      ])
    );

    const { result } = renderHook(() => usePatients());

    await waitFor(() => {
      expect(result.current.patients).toHaveLength(1);
    });

    const repairedMainRaw = storage.getItem(MAIN_KEY);
    expect(repairedMainRaw).not.toBeNull();

    const repairedMain = JSON.parse(repairedMainRaw);
    expect(repairedMain).toHaveLength(1);
    expect(repairedMain[0].idNumber).toBe("123");
  });
});
