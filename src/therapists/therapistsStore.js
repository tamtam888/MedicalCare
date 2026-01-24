// src/therapists/therapistsStore.js
import { get, set } from "idb-keyval";

const THERAPISTS_KEY = "mc_therapists_v1";
const LEGACY_LOCALSTORAGE_KEY = "mc_therapists";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalize(value) {
  return String(value ?? "").trim();
}

function digitsOnly(value) {
  return normalize(value).replace(/\D/g, "");
}

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function hslToHex(h, s, l) {
  const hh = ((h % 360) + 360) % 360;
  const ss = clamp(s, 0, 100) / 100;
  const ll = clamp(l, 0, 100) / 100;

  const c = (1 - Math.abs(2 * ll - 1)) * ss;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = ll - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;

  if (hh < 60) [r, g, b] = [c, x, 0];
  else if (hh < 120) [r, g, b] = [x, c, 0];
  else if (hh < 180) [r, g, b] = [0, c, x];
  else if (hh < 240) [r, g, b] = [0, x, c];
  else if (hh < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];

  const rr = Math.round((r + m) * 255);
  const gg = Math.round((g + m) * 255);
  const bb = Math.round((b + m) * 255);

  const toHex = (v) => v.toString(16).padStart(2, "0");
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

function hash32(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeStableColorFromSeed(seed) {
  const base = hash32(seed);
  const hue = base % 360;
  return hslToHex(hue, 70, 50);
}

function isValidTherapistId(id) {
  return /^\d{9}$/.test(String(id || ""));
}

function normalizeFromLegacyItem(raw) {
  const id =
    digitsOnly(raw?.idNumber) ||
    digitsOnly(raw?.id_number) ||
    digitsOnly(raw?.id) ||
    digitsOnly(raw?.therapistId);

  if (!isValidTherapistId(id)) return null;

  const name =
    normalize(raw?.fullName) ||
    normalize(raw?.full_name) ||
    normalize(raw?.name) ||
    normalize(raw?.displayName) ||
    id;

  const active = raw?.active !== false;

  const colorRaw = normalize(raw?.color);
  const color =
    colorRaw && /^#([0-9a-fA-F]{6})$/.test(colorRaw)
      ? colorRaw.toLowerCase()
      : makeStableColorFromSeed(id);

  return { id, name, active, color };
}

function normalizeFromIdbItem(raw) {
  const id = digitsOnly(raw?.id) || digitsOnly(raw?.idNumber) || digitsOnly(raw?.therapistId);
  if (!isValidTherapistId(id)) return null;

  const name =
    normalize(raw?.name) ||
    normalize(raw?.fullName) ||
    normalize(raw?.displayName) ||
    normalize(raw?.full_name) ||
    id;

  const active = raw?.active !== false;

  const colorRaw = normalize(raw?.color);
  const color =
    colorRaw && /^#([0-9a-fA-F]{6})$/.test(colorRaw)
      ? colorRaw.toLowerCase()
      : makeStableColorFromSeed(id);

  return { id, name, active, color };
}

async function readAllRaw() {
  const raw = await get(THERAPISTS_KEY);
  return safeArray(raw);
}

async function writeAll(list) {
  await set(THERAPISTS_KEY, list);
}

function tryReadLegacyFromLocalStorage() {
  try {
    const raw = localStorage.getItem(LEGACY_LOCALSTORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function uniqueById(list) {
  const map = new Map();
  for (const item of list) {
    if (!item || !item.id) continue;
    const id = String(item.id);
    if (!map.has(id)) map.set(id, item);
  }
  return Array.from(map.values());
}

function sortByName(list) {
  return list.slice().sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));
}

function hasExtraFieldsBeyondCalendarShape(item) {
  if (!item || typeof item !== "object") return false;
  const allowed = new Set(["id", "name", "active", "color"]);
  return Object.keys(item).some((k) => !allowed.has(k));
}

async function migrateOrRepairIfNeeded() {
  const idbRaw = await readAllRaw();
  const idbNormalized = uniqueById(idbRaw.map(normalizeFromIdbItem).filter(Boolean));

  const legacyRaw = tryReadLegacyFromLocalStorage();
  const legacyNormalized = uniqueById(legacyRaw.map(normalizeFromLegacyItem).filter(Boolean));

  const idbHasAny = idbNormalized.length > 0;
  const legacyHasAny = legacyNormalized.length > 0;

  const idbHasInvalid = safeArray(idbRaw).some((t) => {
    const id = digitsOnly(t?.id) || digitsOnly(t?.idNumber) || digitsOnly(t?.therapistId);
    return id && !isValidTherapistId(id);
  });

  const shouldSeedFromLegacy = (!idbHasAny && legacyHasAny) || (idbHasInvalid && legacyHasAny);

  if (shouldSeedFromLegacy) {
    await writeAll(legacyNormalized);
    return legacyNormalized;
  }

  if (!idbHasAny) {
    return [];
  }

  const rawHasExtraFields = safeArray(idbRaw).some(hasExtraFieldsBeyondCalendarShape);

  const changed =
    idbRaw.length !== idbNormalized.length ||
    idbRaw.some((t, i) => {
      const prev = t || {};
      const next = idbNormalized[i] || {};
      return (
        digitsOnly(prev.id) !== digitsOnly(next.id) ||
        normalize(prev.name) !== normalize(next.name) ||
        normalize(prev.fullName) !== normalize(next.name) ||
        (prev.active !== false) !== (next.active !== false) ||
        normalize(prev.color).toLowerCase() !== normalize(next.color).toLowerCase()
      );
    });

  if (changed && !rawHasExtraFields) {
    await writeAll(idbNormalized);
  }

  return idbNormalized;
}

export async function getAllTherapists() {
  const list = await migrateOrRepairIfNeeded();
  return sortByName(list);
}

export async function upsertTherapist(input) {
  const existing = await getAllTherapists();

  const id = digitsOnly(input?.idNumber ?? input?.id ?? input?.therapistId);
  if (!isValidTherapistId(id)) {
    throw new Error("Therapist ID must be 9 digits.");
  }

  const name = normalize(input?.name ?? input?.fullName ?? input?.displayName) || id;
  const active = input?.active !== false;

  const existingIdx = existing.findIndex((t) => String(t.id) === String(id));
  const existingColor = existingIdx >= 0 ? String(existing[existingIdx]?.color || "").toLowerCase() : "";
  const color = existingColor || makeStableColorFromSeed(id);

  const next = { id, name, active, color };

  const updated =
    existingIdx >= 0 ? existing.map((t, i) => (i === existingIdx ? next : t)) : [next, ...existing];

  await writeAll(updated);
  return next;
}

export async function deleteTherapist(id) {
  const existing = await getAllTherapists();
  const target = digitsOnly(id);
  if (!target) return true;

  const next = existing.filter((t) => digitsOnly(t.id) !== target);
  await writeAll(next);
  return true;
}
