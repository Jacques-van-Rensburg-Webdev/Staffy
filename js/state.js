// App state: defaults, example data, and saving on this device (localStorage).
import { uid, pad, nextMonth } from './util.js';

const STORAGE_KEY = 'staffy.state';
const TAB_KEY = 'staffy.tab';
const VIEW_KEY = 'staffy.view';
const SAVE_DELAY = 700;

export const TABS = ['plan', 'staff', 'shifts', 'leave'];

const SHIFT_EARLY = { id: 'early', name: 'Early', code: 'E', start: '06:00', end: '14:00', brk: 30, tag: 'n', color: 0 };
const SHIFT_DAY = { id: 'day', name: 'Day', code: 'D', start: '09:00', end: '17:00', brk: 30, tag: 'd', color: 1 };
const SHIFT_LATE = { id: 'late', name: 'Late', code: 'L', start: '14:00', end: '22:00', brk: 30, tag: 'n', color: 2 };
const SHIFT_NIGHT = { id: 'night', name: 'Night', code: 'N', start: '22:00', end: '06:00', brk: 30, tag: 'u', color: 3 };

export function blankState() {
  return {
    v: 1,
    example: false,
    month: nextMonth(),
    settings: { minRest: 11, maxConsec: 6, weekendUndesirable: true, leaveReduces: true },
    staff: [],
    shifts: [{ ...SHIFT_EARLY }, { ...SHIFT_LATE }, { ...SHIFT_NIGHT }],
    // needs are indexed by getDay(): [Sun, Mon, Tue, Wed, Thu, Fri, Sat]
    needs: { early: [1, 2, 2, 2, 2, 2, 1], late: [1, 1, 1, 1, 1, 1, 1], night: [1, 1, 1, 1, 1, 1, 1] },
    // minimum people of a position per shift: { shiftId: { positionKey: [Sun … Sat] } }, part of the headcount above
    posNeeds: {},
    overrides: {},
    leave: [],
    requests: [],
    recurring: [],
    plan: null,
  };
}

// A made-up team so the planner has something to show on first open.
export function exampleState() {
  const st = blankState();
  st.example = true;
  const m = st.month;
  st.shifts = [{ ...SHIFT_EARLY }, { ...SHIFT_DAY }, { ...SHIFT_LATE }, { ...SHIFT_NIGHT }];
  st.needs = {
    early: [1, 2, 2, 2, 2, 2, 1],
    day: [0, 1, 1, 1, 1, 1, 0],
    late: [1, 1, 1, 1, 1, 1, 1],
    night: [1, 1, 1, 1, 1, 1, 1],
  };
  const names = [
    ['Anna Weber', 160, 'Nurse'], ['Ben Okafor', 160, 'Nurse'], ['Carla Rossi', 120, 'Assistant'], ['David Krüger', 160, 'Nurse'],
    ['Elif Yilmaz', 80, 'Assistant'], ['Felix Brandt', 140, 'Assistant'], ['Greta Lind', 160, 'Nurse'], ['Hamid Nasser', 100, 'Assistant'],
  ];
  st.staff = names.map(([name, hours, position], i) => ({ id: `s${i}`, name, hours, position }));
  // Every early and night shift needs at least one nurse.
  st.posNeeds = { early: { nurse: [1, 1, 1, 1, 1, 1, 1] }, night: { nurse: [1, 1, 1, 1, 1, 1, 1] } };
  const D = (d) => `${m}-${pad(d)}`;
  st.leave = [
    { id: uid(), staffId: 's5', from: D(21), to: D(27), note: 'Holiday' },
    { id: uid(), staffId: 's6', from: D(28), to: D(31), note: 'Holiday' },
  ];
  st.requests = [
    { id: uid(), staffId: 's0', date: D(24), kind: 'off', shiftId: '' },
    { id: uid(), staffId: 's1', date: D(3), kind: 'want', shiftId: 'early' },
    { id: uid(), staffId: 's2', date: D(12), kind: 'avoid', shiftId: 'night' },
    { id: uid(), staffId: 's3', date: D(31), kind: 'off', shiftId: '' },
    { id: uid(), staffId: 's4', date: D(8), kind: 'want', shiftId: 'day' },
  ];
  st.overrides = { [D(25)]: { day: 0 }, [D(26)]: { day: 0 } };
  // Standing rules: dow '' = any day, otherwise a getDay() value (0 = Sunday).
  st.recurring = [
    { id: uid(), staffId: 's2', dow: 0, kind: 'off', shiftId: '', strict: true },
    { id: uid(), staffId: 's4', dow: '', kind: 'avoid', shiftId: 'night', strict: true },
    { id: uid(), staffId: 's7', dow: 1, kind: 'want', shiftId: 'early', strict: false },
  ];
  return st;
}

export function normalize(st) {
  const b = blankState();
  return Object.assign(b, st, { settings: Object.assign(b.settings, st.settings || {}) });
}

let state = blankState();
let statusHandler = () => {};
let saveTimer = null;

export const getState = () => state;
export function setState(next) { state = next; }
export function onStatus(fn) { statusHandler = fn; }

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    statusHandler('Saved on this device', false);
  } catch {
    statusHandler('Not saved: storage unavailable here', true);
  }
}

// Call after any edit. Marks example data as edited and saves shortly after.
export function changed() {
  if (state.example) state.example = 'edited';
  clearTimeout(saveTimer);
  statusHandler('Unsaved changes', false);
  saveTimer = setTimeout(save, SAVE_DELAY);
}

export function load() {
  let loaded = null;
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (t) loaded = JSON.parse(t);
    statusHandler(loaded ? 'Saved on this device' : 'Example data, not saved yet', false);
  } catch {
    statusHandler('Not saved: storage unavailable here', true);
  }
  state = loaded ? normalize(loaded) : exampleState();
  return state;
}

export function readTab() {
  try {
    const t = localStorage.getItem(TAB_KEY);
    return TABS.includes(t) ? t : 'plan';
  } catch {
    return 'plan';
  }
}
export function storeTab(tab) {
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    // Storage unavailable: the tab just isn't remembered.
  }
}

// Rota view: 'grid' (people down, days across) or 'calendar'.
export function readView() {
  try {
    return localStorage.getItem(VIEW_KEY) === 'calendar' ? 'calendar' : 'grid';
  } catch {
    return 'grid';
  }
}
export function storeView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    // Storage unavailable: the view just isn't remembered.
  }
}
