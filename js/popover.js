// Shift picker that opens over a rota cell.
import { ctx, evaluate } from './schedule.js';
import { esc, fmtDateLong, shiftClass, staffName } from './util.js';

const pop = document.getElementById('pop');
let popKey = null;
let popBtn = null;

// Viewport gap read from tokens.css so the popover never hugs the edge.
const gap = () => parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--space-1')) || 8;

function focusById(id) {
  const el = id && document.getElementById(id);
  if (el) el.focus();
}

export function hidePopover() {
  if (!pop.hidden) {
    pop.hidden = true;
    popKey = null;
  }
}

export function openPopover(S, btn) {
  popKey = btn.dataset.cell;
  popBtn = btn;
  const [sid, date] = popKey.split('|');
  const hasPlan = !!(S.plan && S.plan.month === S.month);
  const cur = hasPlan ? S.plan.cells[popKey] : undefined;
  const C = ctx(S);
  const E = evaluate(C, hasPlan ? S.plan.cells : {});
  const onLeave = C.leave[sid] && C.leave[sid].has(date);
  const blocked = C.blockedDay(sid, date);
  let note = '';
  if (onLeave) note = ' · <span class="text-warn">on leave</span>';
  else if (blocked) note = ' · <span class="text-warn">fixed day off</span>';

  let h = `<div class="popover-head"><b>${esc(staffName(S, sid))}</b> · ${fmtDateLong(date)}${note}</div>`;
  for (const sh of S.shifts) {
    h += `<button class="popover-option${cur === sh.id ? ' is-current' : ''}" type="button" data-pick="${sh.id}"><span class="swatch swatch-shift ${shiftClass(sh)}"></span><b class="mono">${esc(sh.code)}</b> ${esc(sh.name)} <span class="popover-option-time">${esc(sh.start)}–${esc(sh.end)}</span></button>`;
  }
  h += `<button class="popover-option${!cur ? ' is-current' : ''}" type="button" data-pick=""><span class="swatch swatch-off"></span>Off</button>`;
  const iss = E.issues[popKey];
  if (iss) h += iss.map((m) => `<div class="popover-msg">${esc(m)}</div>`).join('');
  pop.innerHTML = h;
  pop.hidden = false;

  const g = gap();
  const r = btn.getBoundingClientRect();
  const pw = pop.offsetWidth;
  const ph = pop.offsetHeight;
  const x = Math.max(g, Math.min(r.left, window.innerWidth - pw - g));
  let y = r.bottom + g / 2;
  if (y + ph > window.innerHeight - g) y = Math.max(g, r.top - ph - g / 2);
  pop.style.left = `${x}px`;
  pop.style.top = `${y}px`;

  const f = pop.querySelector('.is-current') || pop.querySelector('button');
  if (f) f.focus();
}

// Apply a pick to the plan. Returns the id of the cell button to refocus, or null.
export function pickShift(S, shId) {
  if (!popKey) return null;
  if (!S.plan || S.plan.month !== S.month) {
    S.plan = { month: S.month, cells: {}, generatedAt: new Date().toISOString(), runs: 0, edited: true };
  }
  if (shId) S.plan.cells[popKey] = shId;
  else delete S.plan.cells[popKey];
  S.plan.edited = true;
  const id = popBtn && popBtn.id;
  hidePopover();
  return id;
}

export function initPopover() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pop.hidden) {
      const id = popBtn && popBtn.id;
      hidePopover();
      focusById(id);
    }
  });
  window.addEventListener('resize', hidePopover);
  document.addEventListener('scroll', (e) => {
    if (!pop.contains(e.target)) hidePopover();
  }, true);
}
