// src/notifications/notificationsStore.js
const VER = "v1";

function safeParse(raw, fallback) {
  try {
    const v = raw ? JSON.parse(raw) : fallback;
    return v ?? fallback;
  } catch {
    return fallback;
  }
}

function keyFor(userKey, part) {
  return `mc_notifs_${VER}_${part}_${userKey}`;
}

export function createUserKey({ isAdmin, therapistId }) {
  if (isAdmin) return "admin";
  const tid = String(therapistId || "").trim();
  return tid ? `t:${tid}` : "t:unknown";
}

function loadList(k) {
  const raw = localStorage.getItem(k);
  const parsed = safeParse(raw, []);
  return Array.isArray(parsed) ? parsed : [];
}

function saveList(k, v) {
  localStorage.setItem(k, JSON.stringify(Array.isArray(v) ? v : []));
}

function loadObj(k) {
  const raw = localStorage.getItem(k);
  const parsed = safeParse(raw, {});
  return parsed && typeof parsed === "object" ? parsed : {};
}

function saveObj(k, v) {
  localStorage.setItem(k, JSON.stringify(v && typeof v === "object" ? v : {}));
}

function digitsOnly(value) {
  return String(value ?? "").replace(/\D/g, "").trim();
}

function toMs(value) {
  const d = value instanceof Date ? value : new Date(value);
  const t = d.getTime();
  return Number.isFinite(t) ? t : NaN;
}

function normalizeStatus(value) {
  const s = String(value || "").toLowerCase().trim();
  if (s === "cancel" || s === "canceled" || s === "cancelled") return "cancelled";
  if (s === "completed" || s === "complete" || s === "done") return "completed";
  if (s === "scheduled" || s === "booked") return "scheduled";
  if (!s) return "scheduled";
  return s;
}

function formatHM(dateLike) {
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function formatDMY(dateLike) {
  const d = new Date(dateLike);
  if (!Number.isFinite(d.getTime())) return "";
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function buildSnap(appointments, filterTherapistId) {
  const out = {};
  const tid = String(filterTherapistId || "").trim();
  for (const a of Array.isArray(appointments) ? appointments : []) {
    if (!a) continue;
    const id = String(a.id || "").trim();
    if (!id) continue;
    const aTid = String(a.therapistId || "").trim();
    if (tid && aTid !== tid) continue;
    out[id] = {
      id,
      therapistId: aTid,
      patientId: digitsOnly(a.patientId),
      start: a.start || null,
      end: a.end || null,
      status: normalizeStatus(a.status),
    };
  }
  return out;
}

function uniqById(list) {
  const seen = new Set();
  const out = [];
  for (const n of Array.isArray(list) ? list : []) {
    const id = String(n?.id || "");
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(n);
  }
  return out;
}

function limit(list, max = 200) {
  const arr = Array.isArray(list) ? list : [];
  return arr.length > max ? arr.slice(0, max) : arr;
}

function makeCreated(next, label) {
  const d = formatDMY(next.start);
  const t1 = formatHM(next.start);
  const t2 = formatHM(next.end);
  const when = d ? `${d} ${t1}${t2 ? `-${t2}` : ""}` : `${t1}${t2 ? `-${t2}` : ""}`;
  const base = label || "Appointment";
  return { title: "New appointment", message: when ? `${base} scheduled: ${when}.` : `${base} scheduled.` };
}

function makeCancelled(next, prevStart, label) {
  const d = formatDMY(next.start || prevStart);
  const t = formatHM(next.start || prevStart);
  const when = d && t ? `${d} ${t}` : d ? d : t ? t : "";
  const base = label || "Appointment";
  return { title: "Appointment cancelled", message: when ? `${base} (${when}) was cancelled.` : `${base} was cancelled.` };
}

function makeRemoved(prev, label) {
  const d = formatDMY(prev.start);
  const t = formatHM(prev.start);
  const when = d && t ? `${d} ${t}` : d ? d : t ? t : "";
  const base = label || "Appointment";
  return { title: "Appointment removed", message: when ? `${base} (${when}) was removed.` : `${base} was removed.` };
}

function makeMoved(next, prevStart, label) {
  const d = formatDMY(next.start);
  const from = formatHM(prevStart);
  const to = formatHM(next.start);
  const base = label || "Appointment";
  return {
    title: "Time changed",
    message: d ? `${base} moved on ${d} from ${from} to ${to}.` : `${base} moved from ${from} to ${to}.`,
  };
}

function markSent(userKey, ids) {
  const k = keyFor(userKey, "sent");
  const prev = loadObj(k);
  const now = Date.now();
  for (const id of Array.isArray(ids) ? ids : []) prev[String(id)] = now;
  saveObj(k, prev);
}

function alreadySent(userKey, id, maxAgeMs) {
  const k = keyFor(userKey, "sent");
  const prev = loadObj(k);
  const ts = Number(prev[String(id)]);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= maxAgeMs;
}

export function getDismissedIds(userKey) {
  return loadList(keyFor(userKey, "dismissed"));
}

export function setDismissedIds(userKey, ids) {
  saveList(keyFor(userKey, "dismissed"), Array.from(new Set(Array.isArray(ids) ? ids : [])));
}

export function dismissNotifications(userKey, ids) {
  const dismissed = new Set(getDismissedIds(userKey));
  for (const id of Array.isArray(ids) ? ids : []) dismissed.add(String(id));
  setDismissedIds(userKey, Array.from(dismissed));
}

export function getStoredNotifications(userKey) {
  return loadList(keyFor(userKey, "items"));
}

export function clearStoredNotifications(userKey, ids) {
  const remove = new Set(Array.isArray(ids) ? ids.map(String) : []);
  const prev = getStoredNotifications(userKey);
  const next = prev.filter((n) => n && n.id && !remove.has(String(n.id)));
  saveList(keyFor(userKey, "items"), next);
}

export function subscribeNotifications(cb) {
  const onStorage = (e) => {
    if (!e?.key) return;
    if (String(e.key).startsWith("mc_notifs_")) cb?.();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export function computeAndStoreNotifications({
  isAdmin,
  therapistId,
  userKey,
  appointments,
  getLabel,
}) {
  const scopeTherapistId = !isAdmin ? String(therapistId || "").trim() : "";
  const snapKey = keyFor(userKey, "snapshot");
  const prevSnap = loadObj(snapKey);
  const nextSnap = buildSnap(appointments, scopeTherapistId || null);

  const dismissed = new Set(getDismissedIds(userKey));
  const notifs = [];

  const prevIds = new Set(Object.keys(prevSnap || {}));
  const nextIds = new Set(Object.keys(nextSnap || {}));

  for (const id of nextIds) {
    const next = nextSnap[id];
    const prev = prevSnap[id];

    if (!prev) {
      if (!isAdmin) {
        const label = typeof getLabel === "function" ? getLabel(next) : "";
        const { title, message } = makeCreated(next, label);
        const nid = `created:${id}:${toMs(next.start)}`;
        if (!dismissed.has(nid)) notifs.push({ id: nid, type: "success", title, message, createdAt: new Date().toISOString() });
      }
      continue;
    }

    const prevStatus = normalizeStatus(prev.status);
    const nextStatus = normalizeStatus(next.status);

    if (prevStatus !== "cancelled" && nextStatus === "cancelled") {
      const label = typeof getLabel === "function" ? getLabel(next) : "";
      const { title, message } = makeCancelled(next, prev.start, label);
      const nid = `cancelled:${id}:${toMs(next.start || prev.start)}`;
      if (!dismissed.has(nid)) notifs.push({ id: nid, type: "error", title, message, createdAt: new Date().toISOString() });
      continue;
    }

    const ps = toMs(prev.start);
    const ns = toMs(next.start);
    const pe = toMs(prev.end);
    const ne = toMs(next.end);

    const timeChanged =
      Number.isFinite(ps) &&
      Number.isFinite(ns) &&
      (ps !== ns || (Number.isFinite(pe) && Number.isFinite(ne) && pe !== ne));

    if (timeChanged) {
      const nid = `time:${id}:${ps}->${ns}`;
      if (!dismissed.has(nid) && !alreadySent(userKey, nid, 2 * 60 * 1000)) {
        const label = typeof getLabel === "function" ? getLabel(next) : "";
        const { title, message } = makeMoved(next, prev.start, label);
        notifs.push({ id: nid, type: "info", title, message, createdAt: new Date().toISOString() });
        markSent(userKey, [nid]);
      }
    }
  }

  for (const id of prevIds) {
    if (nextIds.has(id)) continue;
    const prev = prevSnap[id];
    if (!prev) continue;
    const label = typeof getLabel === "function" ? getLabel(prev) : "";
    const { title, message } = makeRemoved(prev, label);
    const nid = `removed:${id}:${toMs(prev.start)}`;
    if (!dismissed.has(nid)) notifs.push({ id: nid, type: "error", title, message, createdAt: new Date().toISOString() });
  }

  saveObj(snapKey, nextSnap);

  if (!isAdmin && notifs.length) {
    const itemsKey = keyFor(userKey, "items");
    const prevItems = getStoredNotifications(userKey);
    const merged = limit(uniqById([...notifs, ...prevItems]), 200);
    saveList(itemsKey, merged);
  }

  return notifs;
}

export async function pushNotificationsToMedplum({
  medplum,
  notifications,
  recipientPractitionerId,
}) {
  if (!medplum?.isAuthenticated?.()) return { sent: 0, failed: 0 };
  const rid = String(recipientPractitionerId || "").trim();
  if (!rid) return { sent: 0, failed: 0 };

  let sent = 0;
  let failed = 0;

  for (const n of Array.isArray(notifications) ? notifications : []) {
    const id = String(n?.id || "").trim();
    if (!id) continue;
    try {
      await medplum.createResource({
        resourceType: "Communication",
        status: "completed",
        sent: n.createdAt || new Date().toISOString(),
        recipient: [{ reference: `Practitioner/${rid}` }],
        identifier: [{ system: "mc:notification", value: id }],
        payload: [{ contentString: `${String(n.title || "").trim()}: ${String(n.message || "").trim()}` }],
      });
      sent += 1;
    } catch {
      failed += 1;
    }
  }

  return { sent, failed };
}

export async function fetchNotificationsFromMedplum({
  medplum,
  recipientPractitionerId,
  count = 50,
}) {
  if (!medplum?.isAuthenticated?.()) return [];
  const rid = String(recipientPractitionerId || "").trim();
  if (!rid) return [];

  try {
    const list = await medplum.searchResources("Communication", {
      recipient: `Practitioner/${rid}`,
      _sort: "-sent",
      _count: String(count),
    });

    return (Array.isArray(list) ? list : []).map((c) => {
      const ident = Array.isArray(c.identifier) ? c.identifier.find((x) => x?.system === "mc:notification") : null;
      const payload = Array.isArray(c.payload) ? c.payload[0] : null;
      const text = String(payload?.contentString || "").trim();
      const parts = text.split(":");
      const title = String(parts.shift() || "Notification").trim();
      const message = String(parts.join(":") || "").trim();
      return {
        id: String(ident?.value || c.id || "").trim(),
        type: "info",
        title,
        message: message || text,
        createdAt: c.sent || c.authoredOn || new Date().toISOString(),
      };
    }).filter((n) => n.id);
  } catch {
    return [];
  }
}
