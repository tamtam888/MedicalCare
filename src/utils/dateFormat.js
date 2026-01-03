// src/utils/dateFormat.js
function isDate(d) {
  return d instanceof Date && Number.isFinite(d.getTime());
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

export function parseFlexibleDate(value) {
  if (!value && value !== 0) return null;
  if (isDate(value)) return value;

  if (typeof value === "number") {
    const d = new Date(value);
    return isDate(d) ? d : null;
  }

  const s = String(value).trim();
  if (!s) return null;

  // DMY: 31/12/2025 or 31-12-2025
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})(?:\s.*)?$/);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    let yyyy = Number(m[3]);
    if (yyyy < 100) yyyy += 2000;

    const d = new Date(yyyy, mm - 1, dd, 12, 0, 0, 0);
    return isDate(d) ? d : null;
  }

  // ISO / browser-native parse
  const d = new Date(s);
  return isDate(d) ? d : null;
}

export function formatDateDMY(value) {
  const d = parseFlexibleDate(value);
  if (!d) return "";
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function formatDateTimeDMY(value) {
  const d = parseFlexibleDate(value);
  if (!d) return "";
  return `${formatDateDMY(d)} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function toISODateInput(value) {
  const d = parseFlexibleDate(value) ?? new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function fromISODateInput(value) {
  const s = String(value || "").trim();
  if (!s) return new Date().toISOString();
  // Force local date (midday) -> ISO to avoid timezone shifts
  const d = new Date(`${s}T12:00:00`);
  return isDate(d) ? d.toISOString() : new Date().toISOString();
}
