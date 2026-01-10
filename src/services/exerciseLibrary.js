// src/services/exerciseLibrary.js
const LOCAL_KEY = "exercise_library_v1";

const EXERCISE_CODE_SYSTEM = "https://medicalcare.app/codes";
const EXERCISE_CODE = "exercise";

const EXT_BASE = "https://medicalcare.app/exercise";
const EXT_NAME = `${EXT_BASE}/name`;
const EXT_INSTRUCTIONS = `${EXT_BASE}/instructions`;
const EXT_TAGS = `${EXT_BASE}/tags`;
const EXT_MEDIA_URL = `${EXT_BASE}/mediaUrl`;
const EXT_SCOPE = `${EXT_BASE}/scope`;
const EXT_AUTHOR = `${EXT_BASE}/author`;
const EXT_UPDATED_AT = `${EXT_BASE}/updatedAt`;
const EXT_ARCHIVED = `${EXT_BASE}/archived`;

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = "ex") {
  const id = globalThis.crypto?.randomUUID?.();
  return id ? `${prefix}_${id}` : `${prefix}_${Date.now()}`;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function ensureArray(v) {
  return Array.isArray(v) ? v : [];
}

function loadLocalRaw() {
  if (typeof window === "undefined") return [];
  const raw = window.localStorage.getItem(LOCAL_KEY);
  const parsed = safeJsonParse(raw);
  return Array.isArray(parsed) ? parsed : [];
}

function saveLocalRaw(rows) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_KEY, JSON.stringify(Array.isArray(rows) ? rows : []));
}

function isLoggedIn(medplum) {
  try {
    const token = typeof medplum?.getAccessToken === "function" ? medplum.getAccessToken() : null;
    if (token && String(token).trim().length > 10) return true;

    const profile = typeof medplum?.getProfile === "function" ? medplum.getProfile() : null;
    if (profile && profile.resourceType) return true;

    return false;
  } catch {
    return false;
  }
}

function getProfileRef(medplum) {
  try {
    const p = typeof medplum?.getProfile === "function" ? medplum.getProfile() : null;
    if (p?.resourceType && p?.id) return `${p.resourceType}/${p.id}`;
  } catch {}
  return null;
}

function normalizeExercise(input) {
  const x = input && typeof input === "object" ? input : {};
  const name = String(x.name || "").trim();
  const instructions = String(x.instructions || "").trim();
  const tags = ensureArray(x.tags).map((t) => String(t || "").trim()).filter(Boolean);
  const mediaUrl = x.mediaUrl ? String(x.mediaUrl).trim() : "";
  const scope = x.scope === "user" ? "user" : "global";
  const archived = !!x.archived;
  return { name, instructions, tags, mediaUrl, scope, archived };
}

export function listLocalExercises({ includeArchived = false } = {}) {
  const rows = loadLocalRaw();
  const mapped = rows
    .filter((r) => r && typeof r === "object" && r.id && r.data)
    .map((r) => {
      const d = normalizeExercise(r.data);
      return {
        id: String(r.id),
        medplumId: r.medplumId ? String(r.medplumId) : "",
        updatedAt: String(r.updatedAt || ""),
        syncedAt: r.syncedAt ? String(r.syncedAt) : "",
        dirty: !!r.dirty,
        scope: r.scope === "user" ? "user" : "global",
        ...d,
      };
    })
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));

  return includeArchived ? mapped : mapped.filter((x) => !x.archived);
}

export function upsertLocalExercise(exercise) {
  const data = normalizeExercise(exercise);
  if (!data.name) throw new Error("Exercise name is required.");

  const id = exercise?.id ? String(exercise.id) : createId("ex");
  const updatedAt = nowIso();

  const prev = loadLocalRaw();
  const existing = prev.find((r) => String(r.id) === id);

  const nextRow = {
    id,
    medplumId: existing?.medplumId || (exercise?.medplumId ? String(exercise.medplumId) : ""),
    updatedAt,
    syncedAt: existing?.syncedAt || "",
    dirty: true,
    scope: data.scope,
    data,
  };

  const next = [nextRow, ...prev.filter((r) => String(r.id) !== id)];
  saveLocalRaw(next);

  return {
    id,
    medplumId: nextRow.medplumId || "",
    updatedAt,
    syncedAt: nextRow.syncedAt || "",
    dirty: true,
    ...data,
  };
}

export function archiveLocalExercise(id, archived = true) {
  const key = String(id || "").trim();
  if (!key) return;

  const prev = loadLocalRaw();
  const next = prev.map((r) => {
    if (String(r?.id) !== key) return r;
    const d = normalizeExercise(r.data);
    return {
      ...r,
      updatedAt: nowIso(),
      dirty: true,
      data: { ...d, archived: !!archived },
    };
  });

  saveLocalRaw(next);
}

/**
 * Seed local exercises once (add-only, no deletes, no overwrites).
 * seedItems format: [{ name, instructions, tags, mediaUrl, scope }]
 */
export function seedLocalExercisesOnce(seedItems = []) {
  const seed = Array.isArray(seedItems) ? seedItems : [];
  if (seed.length === 0) return { added: 0 };

  const prev = loadLocalRaw();
  const existsByKey = new Set(
    prev.map((r) => {
      const d = r?.data || {};
      return `${String(d?.name || "").trim().toLowerCase()}|${String(r?.scope || d?.scope || "global")}`;
    })
  );

  let added = 0;
  for (const item of seed) {
    const d = normalizeExercise(item);
    if (!d.name) continue;
    const key = `${d.name.toLowerCase()}|${d.scope}`;
    if (existsByKey.has(key)) continue;

    prev.unshift({
      id: createId("ex"),
      medplumId: "",
      updatedAt: nowIso(),
      syncedAt: "",
      dirty: true,
      scope: d.scope,
      data: d,
    });
    existsByKey.add(key);
    added++;
  }

  saveLocalRaw(prev);
  return { added };
}

function extGet(resource, url) {
  const ext = ensureArray(resource?.extension);
  const found = ext.find((e) => e?.url === url);
  if (!found) return null;
  if (typeof found.valueString === "string") return found.valueString;
  return null;
}

function extSet(list, url, valueString) {
  if (valueString === undefined || valueString === null) return list;
  return [...list, { url, valueString: String(valueString) }];
}

function toFhirBasicExercise(medplum, localRow) {
  const data = normalizeExercise(localRow?.data || localRow || {});
  const updatedAt = localRow?.updatedAt || nowIso();
  const scope = localRow?.scope === "user" ? "user" : "global";
  const authorRef = scope === "user" ? getProfileRef(medplum) : null;

  let extension = [];
  extension = extSet(extension, EXT_NAME, data.name);
  extension = extSet(extension, EXT_INSTRUCTIONS, data.instructions);
  extension = extSet(extension, EXT_TAGS, data.tags.join(", "));
  extension = extSet(extension, EXT_MEDIA_URL, data.mediaUrl || "");
  extension = extSet(extension, EXT_SCOPE, scope);
  extension = extSet(extension, EXT_AUTHOR, authorRef || "");
  extension = extSet(extension, EXT_UPDATED_AT, updatedAt);
  extension = extSet(extension, EXT_ARCHIVED, data.archived ? "true" : "false");

  return {
    resourceType: "Basic",
    id: localRow?.medplumId || undefined,
    code: {
      coding: [{ system: EXERCISE_CODE_SYSTEM, code: EXERCISE_CODE, display: "Exercise" }],
      text: "Exercise",
    },
    extension,
  };
}

function fromFhirBasicExercise(basic) {
  const name = extGet(basic, EXT_NAME) || "";
  const instructions = extGet(basic, EXT_INSTRUCTIONS) || "";
  const tagsRaw = extGet(basic, EXT_TAGS) || "";
  const mediaUrl = extGet(basic, EXT_MEDIA_URL) || "";
  const scope = (extGet(basic, EXT_SCOPE) || "global") === "user" ? "user" : "global";
  const updatedAt = extGet(basic, EXT_UPDATED_AT) || basic?.meta?.lastUpdated || "";
  const archived = (extGet(basic, EXT_ARCHIVED) || "false").toLowerCase() === "true";

  const tags = tagsRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  return {
    medplumId: String(basic?.id || ""),
    updatedAt: String(updatedAt || ""),
    scope,
    data: normalizeExercise({ name, instructions, tags, mediaUrl, scope, archived }),
  };
}

async function listMedplumExercises(medplum) {
  const res = await medplum.searchResources("Basic", {
    code: `${EXERCISE_CODE_SYSTEM}|${EXERCISE_CODE}`,
    _count: 200,
  });
  return Array.isArray(res) ? res : [];
}

export async function syncExercises(medplum) {
  if (!isLoggedIn(medplum)) {
    return { ok: false, mode: "offline", message: "No Medplum session. Using local only." };
  }

  const local = loadLocalRaw();

  // PUSH dirty -> Medplum
  for (const row of local) {
    if (!row || typeof row !== "object") continue;
    if (!row.dirty) continue;

    const payload = toFhirBasicExercise(medplum, row);

    try {
      let saved = null;
      if (row.medplumId) {
        saved = await medplum.updateResource({ ...payload, id: row.medplumId });
      } else {
        saved = await medplum.createResource(payload);
      }

      if (saved?.id) {
        row.medplumId = String(saved.id);
        row.dirty = false;
        row.syncedAt = nowIso();
      }
    } catch {
      // keep dirty if failed
    }
  }

  saveLocalRaw(local);

  // PULL Medplum -> local
  let basics = [];
  try {
    basics = await listMedplumExercises(medplum);
  } catch {
    return { ok: false, mode: "online", message: "Push done, but pull failed." };
  }

  const remoteRows = basics.map(fromFhirBasicExercise).filter((r) => r.medplumId);

  const byMedplumId = new Map();
  local.forEach((r) => {
    if (r?.medplumId) byMedplumId.set(String(r.medplumId), r);
  });

  function findLocalByNameScope(name, scope) {
    const n = String(name || "").trim().toLowerCase();
    return local.find((r) => {
      const d = r?.data || {};
      return (
        !r?.medplumId &&
        String(d.name || "").trim().toLowerCase() === n &&
        String(r.scope || d.scope || "global") === scope
      );
    });
  }

  for (const rr of remoteRows) {
    const existing = byMedplumId.get(rr.medplumId);

    if (existing) {
      if (existing.dirty) continue;

      const localUpdated = String(existing.updatedAt || "");
      const remoteUpdated = String(rr.updatedAt || "");
      const useRemote = remoteUpdated && remoteUpdated >= localUpdated;

      if (useRemote) {
        existing.updatedAt = rr.updatedAt || nowIso();
        existing.scope = rr.scope;
        existing.data = rr.data;
        existing.dirty = false;
        existing.syncedAt = nowIso();
      }
      continue;
    }

    const maybe = findLocalByNameScope(rr.data?.name, rr.scope);
    if (maybe) {
      if (!maybe.dirty) {
        maybe.medplumId = rr.medplumId;
        maybe.updatedAt = rr.updatedAt || nowIso();
        maybe.scope = rr.scope;
        maybe.data = rr.data;
        maybe.dirty = false;
        maybe.syncedAt = nowIso();
      }
      continue;
    }

    local.unshift({
      id: createId("ex"),
      medplumId: rr.medplumId,
      updatedAt: rr.updatedAt || nowIso(),
      syncedAt: nowIso(),
      dirty: false,
      scope: rr.scope,
      data: rr.data,
    });
  }

  saveLocalRaw(local);
  return { ok: true, mode: "synced", countRemote: remoteRows.length, countLocal: local.length };
}

export async function listExercises(medplum, { wantSync = false, includeArchived = false } = {}) {
  if (wantSync) {
    try {
      await syncExercises(medplum);
    } catch {}
  }
  return listLocalExercises({ includeArchived });
}
