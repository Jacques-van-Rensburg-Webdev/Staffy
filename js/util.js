// Shared helpers: constants, ids, escaping, dates and labels.

export const WEEK = [1, 2, 3, 4, 5, 6, 0]; // Mon … Sun as JS getDay() values
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const COLOR_COUNT = 6; // .shift-1 … .shift-6 in styles.css

export const uid = () => Math.random().toString(36).slice(2, 9);
export const pad = (n) => String(n).padStart(2, '0');

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

export const fmtH = (h) =>
  (Math.round(h * 10) / 10).toLocaleString('en-GB', { maximumFractionDigits: 1 });

export function nextMonth() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

export function monthDays(m) {
  const [y, mo] = m.split('-').map(Number);
  const n = new Date(y, mo, 0).getDate();
  const out = [];
  for (let d = 1; d <= n; d += 1) {
    const dow = new Date(y, mo - 1, d).getDay();
    out.push({ date: `${y}-${pad(mo)}-${pad(d)}`, day: d, dow, we: dow === 0 || dow === 6, idx: d - 1 });
  }
  return out;
}

export function monthName(m) {
  const [y, mo] = m.split('-').map(Number);
  return new Date(y, mo - 1, 1).toLocaleString('en-GB', { month: 'long', year: 'numeric' });
}

function parseDate(d) {
  const [y, mo, dd] = d.split('-').map(Number);
  return new Date(y, mo - 1, dd);
}
export const fmtDate = (d) =>
  parseDate(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtDateLong = (d) =>
  parseDate(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' });

export const toH = (t) => {
  const [h, m] = (t || '0:0').split(':').map(Number);
  return h + (m || 0) / 60;
};

// Start hour, length and paid hours of a shift. Overnight shifts wrap past midnight.
export function shiftGeom(sh) {
  const startH = toH(sh.start);
  let len = toH(sh.end) - startH;
  if (len <= 0) len += 24;
  return { startH, len, paid: Math.max(0, len - (+sh.brk || 0) / 60) };
}

export const shiftClass = (sh) => `shift-${((sh.color || 0) % COLOR_COUNT) + 1}`;

export function staffName(S, id) {
  const s = S.staff.find((x) => x.id === id);
  return s ? s.name : '(removed)';
}
export function shiftName(S, id) {
  const s = S.shifts.find((x) => x.id === id);
  return s ? s.name : 'any shift';
}
export function reqText(S, r) {
  let t;
  if (r.kind === 'off') t = 'day off';
  else if (r.kind === 'want') t = `wants ${r.shiftId ? shiftName(S, r.shiftId) : 'to work'}`;
  else t = `avoid ${shiftName(S, r.shiftId)}`;
  if (r.rule) t += r.rule.dow === '' ? ' (standing wish)' : ` (every ${DOW[r.rule.dow]})`;
  return t;
}

// Which days a recurring rule applies to, as text.
export const ruleDays = (r) => (r.dow === '' || r.dow == null ? 'Any day' : `Every ${DOW[+r.dow]}`);

// One-line description of a recurring rule: "Every Sun · day off · fixed".
export function ruleText(S, r) {
  return `${ruleDays(r)} · ${reqText(S, { kind: r.kind, shiftId: r.shiftId })}${r.strict ? ' · fixed' : ''}`;
}

// A recurring rule applies on a given getDay() value?
export const ruleOnDow = (r, dow) => r.dow === '' || r.dow == null || +r.dow === dow;

// Positions are free text on each person and are matched without regard to case or outer spaces.
export const posKey = (p) => String(p ?? '').trim().toLowerCase();

// Positions in use, in order of first appearance: [{ key, name }].
export function positions(S) {
  const seen = new Map();
  for (const s of S.staff) {
    const key = posKey(s.position);
    if (key && !seen.has(key)) seen.set(key, { key, name: String(s.position).trim() });
  }
  return [...seen.values()];
}
