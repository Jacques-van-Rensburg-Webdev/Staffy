// Entry point: wires the header, tab bar, screens and all event handling together.
import { initGridOverlay } from './grid-overlay.js';
import { blankState, changed, getState, load, onStatus, readTab, setState, storeTab } from './state.js';
import { generate } from './schedule.js';
import { renderPlan } from './render-plan.js';
import { renderStaff } from './render-staff.js';
import { renderShifts } from './render-shifts.js';
import { renderLeave } from './render-leave.js';
import { exampleBanner } from './render-shared.js';
import { hidePopover, initPopover, openPopover, pickShift } from './popover.js';
import { copyTable, exportCSV } from './export.js';
import { COLOR_COUNT, monthDays, uid } from './util.js';

const SCREENS = { plan: renderPlan, staff: renderStaff, shifts: renderShifts, leave: renderLeave };
const GENERATE_DELAY = 20; // lets the "Working…" label paint before the generator runs
const VALIDITY_DELAY = 2000; // how long a form validity message stays

const main = document.getElementById('main');
const statusEl = document.getElementById('status');
const monthEl = document.getElementById('month');
const tabLinks = [...document.querySelectorAll('.app-tabbar [data-tab]')];
const ui = { tab: 'plan', confirmRegen: false };

function setStatus(text, isError) {
  statusEl.textContent = text;
  statusEl.classList.toggle('is-error', !!isError);
}

function tabFromHash() {
  const t = window.location.hash.replace(/^#\/?/, '');
  return SCREENS[t] ? t : null;
}

function focusById(id) {
  const el = id && document.getElementById(id);
  if (el && el !== document.activeElement) el.focus({ preventScroll: true });
}

function render() {
  const S = getState();
  const activeId = document.activeElement && document.activeElement.id;
  monthEl.value = S.month;
  for (const a of tabLinks) {
    if (a.dataset.tab === ui.tab) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
  let html = S.example ? exampleBanner : '';
  html += SCREENS[ui.tab](S, ui);
  main.innerHTML = `<div class="grid">${html}</div>`;
  focusById(activeId);
}

function showTab(tab) {
  ui.tab = tab;
  ui.confirmRegen = false;
  storeTab(tab);
  hidePopover();
  render();
}

function update() {
  changed();
  render();
}

/* ---------- Clicks ---------- */
function onAction(S, a) {
  const id = a.dataset.id;
  switch (a.dataset.act) {
    case 'generate': {
      const edited = S.plan && S.plan.month === S.month && S.plan.edited;
      if (edited && !ui.confirmRegen) {
        ui.confirmRegen = true;
        render();
        return;
      }
      ui.confirmRegen = false;
      a.textContent = 'Working…';
      setTimeout(() => {
        S.plan = generate(S);
        update();
      }, GENERATE_DELAY);
      return;
    }
    case 'clear-example': {
      const b = blankState();
      b.month = S.month;
      setState(b);
      update();
      return;
    }
    case 'del-staff':
      S.staff = S.staff.filter((s) => s.id !== id);
      S.leave = S.leave.filter((l) => l.staffId !== id);
      S.requests = S.requests.filter((r) => r.staffId !== id);
      S.recurring = S.recurring.filter((r) => r.staffId !== id);
      break;
    case 'del-shift':
      S.shifts = S.shifts.filter((s) => s.id !== id);
      delete S.needs[id];
      break;
    case 'add-shift': {
      const nid = uid();
      S.shifts.push({ id: nid, name: 'New shift', code: 'X', start: '08:00', end: '16:00', brk: 30, tag: 'n', color: S.shifts.length % COLOR_COUNT });
      S.needs[nid] = [0, 0, 0, 0, 0, 0, 0];
      break;
    }
    case 'color': {
      const sh = S.shifts.find((s) => s.id === id);
      if (sh) sh.color = ((sh.color || 0) + 1) % COLOR_COUNT;
      break;
    }
    case 'reset-ov':
      for (const k of Object.keys(S.overrides)) if (k.startsWith(S.month)) delete S.overrides[k];
      break;
    case 'del-leave':
      S.leave = S.leave.filter((l) => l.id !== id);
      break;
    case 'del-req':
      S.requests = S.requests.filter((r) => r.id !== id);
      break;
    case 'del-rule':
      S.recurring = S.recurring.filter((r) => r.id !== id);
      break;
    case 'export':
      exportCSV(S, a);
      return;
    case 'copy':
      copyTable(S, a);
      return;
    default:
      return;
  }
  update();
}

document.addEventListener('click', (e) => {
  const S = getState();
  const cell = e.target.closest('[data-cell]');
  if (cell) { openPopover(S, cell); return; }
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const id = pickShift(S, pick.dataset.pick);
    update();
    focusById(id);
    return;
  }
  if (!e.target.closest('#pop')) hidePopover();
  const a = e.target.closest('[data-act]');
  if (a) onAction(S, a);
});

/* ---------- Field edits ---------- */
document.addEventListener('change', (e) => {
  const S = getState();
  const el = e.target;
  const d = el.dataset;
  if (d.staff) {
    const s = S.staff.find((x) => x.id === d.staff);
    if (!s) return;
    s[d.f] = d.f === 'hours' ? Math.max(0, +el.value || 0) : el.value;
  } else if (d.shift) {
    const s = S.shifts.find((x) => x.id === d.shift);
    if (!s) return;
    s[d.f] = d.f === 'brk' ? Math.max(0, +el.value || 0) : el.value;
  } else if (d.need) {
    (S.needs[d.need] = S.needs[d.need] || [0, 0, 0, 0, 0, 0, 0])[+d.dow] = Math.max(0, +el.value || 0);
  } else if (d.ov) {
    const v = Math.max(0, +el.value || 0);
    const day = monthDays(S.month).find((x) => x.date === d.date);
    const def = +((S.needs[d.ov] || [])[day.dow]) || 0;
    const o = (S.overrides[d.date] = S.overrides[d.date] || {});
    if (v === def) delete o[d.ov];
    else o[d.ov] = v;
    if (!Object.keys(o).length) delete S.overrides[d.date];
  } else if (d.set) {
    S.settings[d.set] = el.type === 'checkbox' ? el.checked : Math.max(0, +el.value || 0);
  } else {
    return;
  }
  changed();
  requestAnimationFrame(render);
});

monthEl.addEventListener('change', (e) => {
  if (!/^\d{4}-\d{2}$/.test(e.target.value)) return;
  getState().month = e.target.value;
  ui.confirmRegen = false;
  update();
});

/* ---------- Forms ---------- */
// Show a short validity message on a field, then clear it.
function complain(fid, message) {
  const el = document.getElementById(fid);
  el.setCustomValidity(message);
  el.reportValidity();
  setTimeout(() => el.setCustomValidity(''), VALIDITY_DELAY);
}

function submitForm(S, id) {
  const v = (fid) => document.getElementById(fid).value;
  if (id === 'add-staff') {
    const name = v('ns-name').trim();
    if (!name) {
      const el = document.getElementById('ns-name');
      el.focus();
      el.reportValidity();
      return;
    }
    S.staff.push({ id: uid(), name, hours: Math.max(0, +v('ns-hours') || 0) });
  } else if (id === 'add-leave') {
    const from = v('lv-f');
    let to = v('lv-t');
    if (!from) return;
    if (!to || to < from) to = from;
    S.leave.push({ id: uid(), staffId: v('lv-s'), from, to, note: v('lv-n').trim() });
  } else if (id === 'add-req') {
    const kind = v('rq-k');
    const shiftId = v('rq-sh');
    if (kind === 'avoid' && !shiftId) { complain('rq-sh', 'Pick the shift to avoid'); return; }
    S.requests.push({ id: uid(), staffId: v('rq-s'), date: v('rq-d'), kind, shiftId: kind === 'off' ? '' : shiftId });
  } else if (id === 'add-rule') {
    const kind = v('rr-k');
    const shiftId = v('rr-sh');
    const dow = v('rr-d');
    if (kind === 'off' && dow === '') { complain('rr-d', 'Pick the weekday this person has off'); return; }
    if (kind === 'avoid' && !shiftId) { complain('rr-sh', 'Pick the shift to avoid'); return; }
    S.recurring.push({
      id: uid(),
      staffId: v('rr-s'),
      dow: dow === '' ? '' : +dow,
      kind,
      shiftId: kind === 'off' ? '' : shiftId,
      strict: kind !== 'want' && document.getElementById('rr-x').checked,
    });
  } else {
    return;
  }
  update();
  const first = document.querySelector(`#${id} input[type=text], #${id} select`);
  if (first) first.focus();
}

document.addEventListener('submit', (e) => {
  e.preventDefault();
  submitForm(getState(), e.target.id);
});

/* ---------- Start ---------- */
function init() {
  initGridOverlay();
  initPopover();
  onStatus(setStatus);
  load();
  const fromHash = tabFromHash();
  ui.tab = fromHash || readTab();
  if (!fromHash) window.history.replaceState(null, '', `#/${ui.tab}`);
  window.addEventListener('hashchange', () => showTab(tabFromHash() || 'plan'));
  render();
}

init();
