// src/pages/UsersPage.jsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Search, Pencil, Trash2, X, RefreshCw } from "lucide-react";
import { useAuthContext } from "../hooks/useAuthContext";
import "./UsersPage.css";

const LS_STORAGE_KEY = "mc_therapists";
const IDB_STORAGE_KEY = "mc_therapists_v1";

const IDB_DB_NAME = "keyval-store";
const IDB_STORE_NAME = "keyval";

const DAY_ORDER = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri"];
const DAY_ALIASES = {
  sun: "Sun",
  sunday: "Sun",
  mon: "Mon",
  monday: "Mon",
  tue: "Tue",
  tues: "Tue",
  tuesday: "Tue",
  wed: "Wed",
  weds: "Wed",
  wednesday: "Wed",
  thu: "Thu",
  thur: "Thu",
  thurs: "Thu",
  thursday: "Thu",
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
};

const ACCENT_KEYS = [
  "accent-a",
  "accent-b",
  "accent-c",
  "accent-d",
  "accent-e",
  "accent-f",
  "accent-g",
  "accent-h",
  "accent-i",
  "accent-j",
  "accent-k",
  "accent-l",
];

function safeJsonParse(value, fallback) {
  try {
    if (!value) return fallback;
    const parsed = JSON.parse(value);
    return parsed ?? fallback;
  } catch {
    return fallback;
  }
}

function safeJsonStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return "[]";
  }
}

function normalizeString(v) {
  return String(v ?? "").trim();
}

function normalizeDigits(v) {
  return normalizeString(v).replace(/\D/g, "");
}

function isValidIdNumber(value) {
  return /^\d{9}$/.test(normalizeDigits(value));
}

function uid() {
  return `local-${Math.random().toString(16).slice(2)}-${Date.now().toString(16)}`;
}

function pickRandomAccentKey() {
  const idx = Math.floor(Math.random() * ACCENT_KEYS.length);
  return ACCENT_KEYS[idx] || ACCENT_KEYS[0];
}

function normalizeAccentKey(value) {
  const v = normalizeString(value);
  if (!v) return "";
  return ACCENT_KEYS.includes(v) ? v : "";
}

function tokenizeDays(input) {
  const raw = normalizeString(input);
  if (!raw) return [];
  return raw
    .split(/[\s,.;/|]+/g)
    .map((x) => normalizeString(x))
    .filter(Boolean);
}

function normalizeOneDayToken(token) {
  const t = normalizeString(token).toLowerCase();
  if (!t) return "";
  return DAY_ALIASES[t] || "";
}

function normalizeWorkDaysFromText(text) {
  const tokens = tokenizeDays(text);
  const normalized = [];
  const invalid = [];
  const disallowed = [];

  for (const tok of tokens) {
    const day = normalizeOneDayToken(tok);
    if (!day) invalid.push(tok);
    else if (day === "Sat") disallowed.push(day);
    else normalized.push(day);
  }

  const unique = Array.from(new Set(normalized));
  unique.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));

  return { days: unique, invalid, disallowed };
}

function normalizeWorkDays(value) {
  if (Array.isArray(value)) {
    const normalized = [];
    for (const v of value) {
      const day = normalizeOneDayToken(v);
      if (!day) continue;
      if (day === "Sat") continue;
      if (!DAY_ORDER.includes(day)) continue;
      normalized.push(day);
    }
    const unique = Array.from(new Set(normalized));
    unique.sort((a, b) => DAY_ORDER.indexOf(a) - DAY_ORDER.indexOf(b));
    return unique;
  }
  const s = normalizeString(value);
  if (!s) return [];
  return normalizeWorkDaysFromText(s).days;
}

function formatWorkDays(days) {
  const list = normalizeWorkDays(days);
  return list.join(", ");
}

function normalizeFullName(value) {
  const raw = normalizeString(value).replace(/\s+/g, " ");
  if (!raw) return "";

  const parts = raw.split(" ").filter(Boolean);
  const normalized = parts.map((p) => {
    const cleaned = p.replace(/[^A-Za-z'-]/g, "");
    if (!cleaned) return "";
    const lower = cleaned.toLowerCase();
    return lower.charAt(0).toUpperCase() + lower.slice(1);
  });

  return normalized.filter(Boolean).join(" ");
}

function isValidFullName(value) {
  const normalized = normalizeFullName(value);
  const parts = normalized.split(" ").filter(Boolean);
  if (parts.length < 2) return false;
  return /^[A-Za-z][A-Za-z'-]*(\s[A-Za-z][A-Za-z'-]*)+$/.test(normalized);
}

function normalizePhone(value) {
  const raw = normalizeString(value);
  if (!raw) return "";

  const plus = raw.startsWith("+");
  let digits = raw.replace(/\D/g, "");

  if (plus && digits.startsWith("972")) {
    digits = digits.slice(3);
    digits = `0${digits}`;
  }

  if (!digits.startsWith("0") && digits.length === 9) {
    digits = `0${digits}`;
  }

  return digits;
}

function isValidPhone(value) {
  const v = normalizeString(value);
  if (!v) return true;

  const digits = normalizePhone(v);
  if (!/^\d+$/.test(digits)) return false;

  if (digits.startsWith("05")) return digits.length === 10;
  if (digits.startsWith("0")) return digits.length >= 9 && digits.length <= 10;
  return digits.length >= 9 && digits.length <= 15;
}

function isValidEmail(value) {
  const v = normalizeString(value);
  if (!v) return true;
  return /^\S+@\S+\.\S+$/.test(v);
}

function isValidAddress(value) {
  const v = normalizeString(value);
  if (!v) return true;
  if (v.length < 6) return false;
  const hasLetter = /[A-Za-z]/.test(v);
  const hasNumber = /\d/.test(v);
  return hasLetter && hasNumber;
}

function validateForm(draft, workDaysText) {
  const errors = {};

  const fullName = normalizeFullName(draft.fullName);
  if (!fullName) errors.fullName = "Full name is required.";
  else if (!isValidFullName(fullName)) {
    errors.fullName = "Enter first and last name. Each word must start with a capital letter.";
  }

  const idDigits = normalizeDigits(draft.idNumber);
  if (!idDigits) errors.idNumber = "ID number is required.";
  else if (!isValidIdNumber(idDigits)) errors.idNumber = "ID number must be 9 digits.";

  if (!isValidPhone(draft.phone)) errors.phone = "Phone number is invalid.";
  if (!isValidEmail(draft.email)) errors.email = "Email is invalid.";
  if (!isValidAddress(draft.address)) errors.address = "Address should include letters and a street number.";

  const parsed = normalizeWorkDaysFromText(workDaysText);
  if (parsed.disallowed.length) errors.workDays = "Saturday is not allowed.";
  else if (parsed.invalid.length) errors.workDays = `Invalid work days: ${parsed.invalid.join(", ")}`;

  return errors;
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

function genderNameClass(gender) {
  const g = normalizeString(gender).toLowerCase();
  if (g === "female") return "users-name-female";
  if (g === "male") return "users-name-male";
  return "users-name-none";
}

function maskIdNumber(idNumber) {
  const s = normalizeDigits(idNumber);
  if (!s) return "";
  if (s.length <= 4) return s;
  return `****${s.slice(-4)}`;
}

function defaultDraft() {
  return {
    id: "",
    fullName: "",
    idNumber: "",
    phone: "",
    address: "",
    email: "",
    workDays: [],
    active: true,
    gender: "not_specified",
    accentKey: pickRandomAccentKey(),
    remoteId: null,
  };
}

function coerceTherapistsShape(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.therapists)) return data.therapists;
  return null;
}

function normalizeTherapistRecord(raw) {
  const rawId = normalizeString(raw?.id);
  const rawIdNumber = normalizeDigits(raw?.idNumber);

  const idNumberCandidate =
    rawIdNumber ||
    (isValidIdNumber(rawId) ? rawId : "") ||
    normalizeDigits(raw?.therapistId) ||
    "";

  const fullNameCandidate =
    normalizeString(raw?.fullName) ||
    normalizeString(raw?.name) ||
    normalizeString(raw?.displayName) ||
    "";

  const stableId = idNumberCandidate ? idNumberCandidate : rawId || uid();

  const activeValue =
    typeof raw?.active === "boolean"
      ? raw.active
      : typeof raw?.isActive === "boolean"
        ? raw.isActive
        : true;

  return {
    id: stableId,
    fullName: fullNameCandidate,
    idNumber: idNumberCandidate,
    phone: normalizeString(raw?.phone || ""),
    address: normalizeString(raw?.address || ""),
    email: normalizeString(raw?.email || ""),
    workDays: normalizeWorkDays(raw?.workDays || []),
    active: Boolean(activeValue),
    gender: normalizeString(raw?.gender) || "not_specified",
    accentKey: normalizeAccentKey(raw?.accentKey) || pickRandomAccentKey(),
    remoteId: normalizeString(raw?.remoteId) || null,
  };
}

function normalizeTherapistsList(list) {
  if (!Array.isArray(list)) return [];
  return list.map((x) => normalizeTherapistRecord(x));
}

function readTherapistsFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LS_STORAGE_KEY);
    const data = safeJsonParse(raw, null);
    const list = coerceTherapistsShape(data);
    return normalizeTherapistsList(Array.isArray(list) ? list : []);
  } catch {
    return [];
  }
}

function writeTherapistsToLocalStorage(items) {
  try {
    localStorage.setItem(LS_STORAGE_KEY, safeJsonStringify(items));
  } catch {
    // ignore
  }
}

function idbOpen() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_DB_NAME);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
        db.createObjectStore(IDB_STORE_NAME);
      }
    };
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
  });
}

async function idbGet(key) {
  const db = await idbOpen();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });
  } finally {
    db.close();
  }
}

async function idbSet(key, value) {
  const db = await idbOpen();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      const store = tx.objectStore(IDB_STORE_NAME);
      const req = store.put(value, key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve();
    });
  } finally {
    db.close();
  }
}

function mergeTherapistsLists(primary, secondary) {
  const a = Array.isArray(primary) ? primary : [];
  const b = Array.isArray(secondary) ? secondary : [];

  const keyOf = (t) => {
    const idNumber = normalizeDigits(t?.idNumber);
    if (idNumber) return `idn:${idNumber}`;
    const id = normalizeString(t?.id);
    if (id) return `id:${id}`;
    return `id:${uid()}`;
  };

  const mergeTwo = (prev, next) => {
    const p = normalizeTherapistRecord(prev);
    const n = normalizeTherapistRecord(next);

    const nextWorkDays = Array.isArray(next?.workDays)
      ? normalizeWorkDays(next.workDays)
      : normalizeWorkDays(n.workDays);

    const merged = {
      ...p,
      ...n,
      id:
        normalizeDigits(n.idNumber) ||
        normalizeDigits(p.idNumber) ||
        normalizeString(n.id) ||
        normalizeString(p.id) ||
        uid(),
      idNumber: normalizeDigits(n.idNumber) || normalizeDigits(p.idNumber) || "",
      fullName: normalizeString(n.fullName) || normalizeString(p.fullName) || "",
      email: normalizeString(n.email) || normalizeString(p.email) || "",
      phone: normalizeString(n.phone) || normalizeString(p.phone) || "",
      address: normalizeString(n.address) || normalizeString(p.address) || "",
      workDays: (nextWorkDays ?? normalizeWorkDays(p.workDays)).sort(
        (x, y) => DAY_ORDER.indexOf(x) - DAY_ORDER.indexOf(y)
      ),
      remoteId: normalizeString(n.remoteId) || normalizeString(p.remoteId) || null,
      accentKey: normalizeAccentKey(n.accentKey) || normalizeAccentKey(p.accentKey) || pickRandomAccentKey(),
      gender: normalizeString(n.gender) || normalizeString(p.gender) || "not_specified",
      active: typeof n.active === "boolean" ? n.active : typeof p.active === "boolean" ? p.active : true,
    };

    return merged;
  };

  const map = new Map();

  const put = (t) => {
    const norm = normalizeTherapistRecord(t);
    const k = keyOf(norm);
    const prev = map.get(k);
    map.set(k, prev ? mergeTwo(prev, norm) : norm);
  };

  for (const t of a) put(t);
  for (const t of b) put(t);

  const result = Array.from(map.values());
  result.sort((x, y) => normalizeString(x.fullName).localeCompare(normalizeString(y.fullName)));
  return result;
}

export default function UsersPage({ handleSyncAllTherapistsToMedplum }) {
  const navigate = useNavigate();
  const { isAdmin, therapistId } = useAuthContext();

  const [items, setItems] = useState(() => readTherapistsFromLocalStorage());
  const [query, setQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [mode, setMode] = useState("create");
  const [draft, setDraft] = useState(() => defaultDraft());
  const [workDaysText, setWorkDaysText] = useState(() => formatWorkDays(defaultDraft().workDays));
  const [errors, setErrors] = useState({});

  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const fromIdb = await idbGet(IDB_STORAGE_KEY);
        const idbList = normalizeTherapistsList(coerceTherapistsShape(fromIdb) || []);
        const lsList = readTherapistsFromLocalStorage();

        const merged = mergeTherapistsLists(idbList, lsList);

        if (!cancelled) {
          setItems(merged);
          writeTherapistsToLocalStorage(merged);
          await idbSet(IDB_STORAGE_KEY, merged);
        }
      } catch (err) {
        console.error("Failed to load therapists from IndexedDB:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const normalized = normalizeTherapistsList(items);
    writeTherapistsToLocalStorage(normalized);

    (async () => {
      try {
        await idbSet(IDB_STORAGE_KEY, normalized);
      } catch (err) {
        console.error("Failed to save therapists to IndexedDB:", err);
      }
    })();
  }, [items]);

  const visibleItems = useMemo(() => {
    if (isAdmin) return items;
    const tid = normalizeString(therapistId);
    if (!tid) return [];
    return items.filter((t) => normalizeString(t.id) === tid || normalizeString(t.idNumber) === tid);
  }, [isAdmin, items, therapistId]);

  const filtered = useMemo(() => {
    const q = normalizeString(query).toLowerCase();
    const base = visibleItems;

    if (!q) return base;

    return base.filter((t) => {
      const fullName = normalizeString(t.fullName).toLowerCase();
      const idNumber = normalizeString(t.idNumber).toLowerCase();
      const phone = normalizeString(t.phone).toLowerCase();
      const email = normalizeString(t.email).toLowerCase();
      return (
        fullName.includes(q) ||
        idNumber.includes(q) ||
        maskIdNumber(idNumber).toLowerCase().includes(q) ||
        phone.includes(q) ||
        email.includes(q)
      );
    });
  }, [visibleItems, query]);

  function openCreate() {
    if (!isAdmin) return;
    const next = defaultDraft();
    setMode("create");
    setDraft(next);
    setWorkDaysText(formatWorkDays(next.workDays));
    setErrors({});
    setIsModalOpen(true);
  }

  function openEdit(item) {
    const next = normalizeTherapistRecord(item);
    setMode("edit");
    setDraft(next);
    setWorkDaysText(formatWorkDays(next.workDays));
    setErrors({});
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function upsertItem(next) {
    const normalizedNext = normalizeTherapistRecord(next);

    setItems((prev) => {
      const prevList = Array.isArray(prev) ? prev : [];
      const key = normalizeDigits(normalizedNext.idNumber) || normalizeString(normalizedNext.id);

      const idx = prevList.findIndex((x) => {
        const kx = normalizeDigits(x.idNumber) || normalizeString(x.id);
        return kx === key;
      });

      if (idx === -1) return [normalizedNext, ...prevList];

      const existing = prevList[idx];

      const merged = mergeTherapistsLists([existing], [normalizedNext])[0] || normalizedNext;

      const copy = prevList.slice();
      copy[idx] = merged;
      return copy;
    });
  }

  function onDelete(id) {
    if (!isAdmin) return;
    const target = normalizeDigits(id) || normalizeString(id);
    if (!target) return;
    const ok = window.confirm("Delete this user?");
    if (!ok) return;

    setItems((prev) =>
      (Array.isArray(prev) ? prev : []).filter((x) => {
        const kx = normalizeDigits(x.idNumber) || normalizeString(x.id);
        return kx !== target;
      })
    );
  }

  function onBlurNormalize(field) {
    if (field === "fullName") {
      const v = normalizeFullName(draft.fullName);
      setDraft((p) => ({ ...p, fullName: v }));
      setErrors((p) => ({ ...p, fullName: validateForm({ ...draft, fullName: v }, workDaysText).fullName }));
      return;
    }

    if (field === "idNumber") {
      const v = normalizeDigits(draft.idNumber);
      setDraft((p) => ({ ...p, idNumber: v, id: v || p.id }));
      setErrors((p) => ({ ...p, idNumber: validateForm({ ...draft, idNumber: v }, workDaysText).idNumber }));
      return;
    }

    if (field === "phone") {
      const v = normalizePhone(draft.phone);
      setDraft((p) => ({ ...p, phone: v }));
      setErrors((p) => ({ ...p, phone: validateForm({ ...draft, phone: v }, workDaysText).phone }));
      return;
    }

    if (field === "email") {
      const v = normalizeString(draft.email);
      setDraft((p) => ({ ...p, email: v }));
      setErrors((p) => ({ ...p, email: validateForm({ ...draft, email: v }, workDaysText).email }));
      return;
    }

    if (field === "address") {
      const v = normalizeString(draft.address);
      setDraft((p) => ({ ...p, address: v }));
      setErrors((p) => ({ ...p, address: validateForm({ ...draft, address: v }, workDaysText).address }));
      return;
    }
  }

  function onWorkDaysBlur() {
    const parsed = normalizeWorkDaysFromText(workDaysText);
    const formatted = formatWorkDays(parsed.days);

    setDraft((p) => ({ ...p, workDays: parsed.days }));
    setWorkDaysText(formatted);

    const nextErrors = validateForm({ ...draft, workDays: parsed.days }, formatted);
    setErrors((p) => ({ ...p, workDays: nextErrors.workDays }));
  }

  function onSubmit(e) {
    e.preventDefault();

    const idNumberDigits = normalizeDigits(draft.idNumber);

    const normalizedDraft = {
      ...draft,
      fullName: normalizeFullName(draft.fullName),
      idNumber: idNumberDigits,
      id: idNumberDigits || normalizeString(draft.id) || uid(),
      phone: normalizePhone(draft.phone),
      email: normalizeString(draft.email),
      address: normalizeString(draft.address),
    };

    const parsed = normalizeWorkDaysFromText(workDaysText);
    const formattedDays = formatWorkDays(parsed.days);

    const next = {
      ...normalizedDraft,
      workDays: parsed.days,
      gender: normalizeString(normalizedDraft.gender) || "not_specified",
      active: Boolean(normalizedDraft.active),
      accentKey:
        mode === "create"
          ? pickRandomAccentKey()
          : normalizeAccentKey(normalizedDraft.accentKey) || pickRandomAccentKey(),
      remoteId: normalizeString(normalizedDraft.remoteId) || null,
    };

    const nextErrors = validateForm(next, formattedDays);
    setErrors(nextErrors);
    setDraft(next);
    setWorkDaysText(formattedDays);

    if (hasErrors(nextErrors)) return;

    upsertItem(next);
    closeModal();
  }

  useEffect(() => {
    if (!isAdmin) {
      const tid = normalizeString(therapistId);
      if (!tid) navigate("/login", { replace: true });
    }
  }, [isAdmin, therapistId, navigate]);

  const handleClickSyncAll = async () => {
    if (!isAdmin) return;
    if (typeof handleSyncAllTherapistsToMedplum !== "function") return;
    if (syncing) return;

    try {
      setSyncing(true);
      await handleSyncAllTherapistsToMedplum(items);
    } catch (err) {
      console.error("Sync failed:", err);
      alert(`Sync failed: ${err?.message || "Unknown error"}`);
    } finally {
      setSyncing(false);
    }
  };

  const pageTitle = isAdmin ? "Users" : "My Profile";
  const pageSubtitle = isAdmin ? "Manage therapists" : "Edit your profile";

  return (
    <div className="patients-page users-page">
      <div className="patients-page-header-row">
        <div className="patients-page-header-text">
          <h1 className="patients-page-title">{pageTitle}</h1>
          <p className="patients-page-subtitle">{pageSubtitle}</p>
        </div>

        <div className="patients-page-header-actions">
          {isAdmin ? (
            <>
              <button
                type="button"
                className="patients-toolbar-button"
                onClick={handleClickSyncAll}
                disabled={syncing || typeof handleSyncAllTherapistsToMedplum !== "function"}
              >
                <span className="patients-toolbar-button-icon">
                  <RefreshCw size={16} />
                </span>
                <span>{syncing ? "Syncing..." : "Sync All"}</span>
              </button>

              <button type="button" className="patients-add-button" onClick={openCreate}>
                <span className="patients-add-button-icon">
                  <Plus size={18} />
                </span>
                <span>Add user</span>
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="patients-search-wrapper">
        <span className="patients-search-icon" aria-hidden="true">
          <Search size={16} />
        </span>
        <input
          className="patients-search-input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, ID, phone, email..."
          inputMode="search"
          autoComplete="off"
        />
      </div>

      <div className="users-list-card">
        <table className="users-table" role="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>ID</th>
              <th>Work days</th>
              <th>Status</th>
              <th className="users-actions-col">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length ? (
              filtered.map((t) => (
                <tr key={t.id}>
                  <td className="users-main-cell">
                    <div className="users-main">
                      <div className={`users-main-title ${genderNameClass(t.gender)}`}>
                        {normalizeString(t.fullName) || "—"}
                      </div>
                      <div className="users-main-subtitle">{normalizeString(t.email) || ""}</div>
                    </div>
                  </td>

                  <td>{maskIdNumber(t.idNumber) || "—"}</td>

                  <td>
                    <div className="users-chips">
                      {normalizeWorkDays(t.workDays).length ? (
                        normalizeWorkDays(t.workDays).map((d) => (
                          <span key={`${t.id}-${d}`} className="users-chip">
                            {d}
                          </span>
                        ))
                      ) : (
                        <span className="users-muted">—</span>
                      )}
                    </div>
                  </td>

                  <td>
                    <span className={t.active ? "users-status users-status-on" : "users-status users-status-off"}>
                      {t.active ? "Active" : "Inactive"}
                    </span>
                  </td>

                  <td className="users-row-actions">
                    <button type="button" className="users-icon-btn" onClick={() => openEdit(t)} aria-label="Edit">
                      <Pencil size={16} />
                    </button>
                    {isAdmin ? (
                      <button
                        type="button"
                        className="users-icon-btn users-icon-btn-danger"
                        onClick={() => onDelete(t.idNumber || t.id)}
                        aria-label="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5} className="users-empty-row">
                  No users found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen ? (
        <div className="users-modal-backdrop" role="dialog" aria-modal="true">
          <div className="users-modal">
            <div className="users-modal-header">
              <div className="users-modal-title">{mode === "create" ? "Add user" : "Edit user"}</div>
              <button type="button" className="users-modal-close" onClick={closeModal} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            <form className="users-modal-body" onSubmit={onSubmit}>
              <div className="users-form-grid">
                <label className="users-field">
                  <span className="users-label">Full name</span>
                  <input
                    className={errors.fullName ? "users-input users-input-error" : "users-input"}
                    value={draft.fullName}
                    onChange={(e) => setDraft((p) => ({ ...p, fullName: e.target.value }))}
                    onBlur={() => onBlurNormalize("fullName")}
                    placeholder="First Last"
                    autoComplete="name"
                  />
                  {errors.fullName ? <div className="users-error">{errors.fullName}</div> : null}
                </label>

                <label className="users-field">
                  <span className="users-label">ID number</span>
                  <input
                    className={errors.idNumber ? "users-input users-input-error" : "users-input"}
                    value={draft.idNumber}
                    onChange={(e) => setDraft((p) => ({ ...p, idNumber: e.target.value }))}
                    onBlur={() => onBlurNormalize("idNumber")}
                    placeholder="9 digits"
                    inputMode="numeric"
                    autoComplete="off"
                    disabled={!isAdmin && mode === "edit"}
                  />
                  {errors.idNumber ? <div className="users-error">{errors.idNumber}</div> : null}
                </label>

                <label className="users-field">
                  <span className="users-label">Phone</span>
                  <input
                    className={errors.phone ? "users-input users-input-error" : "users-input"}
                    value={draft.phone}
                    onChange={(e) => setDraft((p) => ({ ...p, phone: e.target.value }))}
                    onBlur={() => onBlurNormalize("phone")}
                    placeholder="05XXXXXXXX"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  {errors.phone ? <div className="users-error">{errors.phone}</div> : null}
                </label>

                <label className="users-field">
                  <span className="users-label">Email</span>
                  <input
                    className={errors.email ? "users-input users-input-error" : "users-input"}
                    value={draft.email}
                    onChange={(e) => setDraft((p) => ({ ...p, email: e.target.value }))}
                    onBlur={() => onBlurNormalize("email")}
                    placeholder="name@example.com"
                    inputMode="email"
                    autoComplete="email"
                  />
                  {errors.email ? <div className="users-error">{errors.email}</div> : null}
                </label>

                <label className="users-field users-field-full">
                  <span className="users-label">Address</span>
                  <input
                    className={errors.address ? "users-input users-input-error" : "users-input"}
                    value={draft.address}
                    onChange={(e) => setDraft((p) => ({ ...p, address: e.target.value }))}
                    onBlur={() => onBlurNormalize("address")}
                    placeholder="Street 12 City"
                    autoComplete="street-address"
                  />
                  {errors.address ? <div className="users-error">{errors.address}</div> : null}
                </label>

                <label className="users-field users-field-full">
                  <span className="users-label">Work days</span>
                  <input
                    className={errors.workDays ? "users-input users-input-error" : "users-input"}
                    value={workDaysText}
                    onChange={(e) => setWorkDaysText(e.target.value)}
                    onBlur={onWorkDaysBlur}
                    placeholder="Sun, Mon, Wed"
                    autoComplete="off"
                  />
                  {errors.workDays ? <div className="users-error">{errors.workDays}</div> : null}
                  <div className="users-hint">Allowed: Sun, Mon, Tue, Wed, Thu, Fri</div>
                </label>

                <label className="users-field">
                  <span className="users-label">Status</span>
                  <select
                    className="users-input"
                    value={draft.active ? "active" : "inactive"}
                    onChange={(e) => setDraft((p) => ({ ...p, active: e.target.value === "active" }))}
                    disabled={!isAdmin}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>

                <label className="users-field">
                  <span className="users-label">Gender</span>
                  <select
                    className="users-input"
                    value={draft.gender}
                    onChange={(e) => setDraft((p) => ({ ...p, gender: e.target.value }))}
                  >
                    <option value="not_specified">Not specified</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </label>
              </div>

              <div className="users-modal-footer">
                <button type="button" className="patients-toolbar-button" onClick={closeModal}>
                  Cancel
                </button>
                <button type="submit" className="patients-add-button">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
