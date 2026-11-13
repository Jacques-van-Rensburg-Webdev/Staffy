// Shifts screen: shift types, default staff needed per weekday, rules, this month's calendar.
import { ctx } from './schedule.js';
import { DOW, WEEK, esc, fmtH, monthName, positions, shiftClass, shiftGeom } from './util.js';
import { removeButton } from './render-shared.js';

const TAGS = [['d', 'Desirable'], ['n', 'Neutral'], ['u', 'Undesirable']];

function shiftTypes(S) {
  let rows = '';
  for (const sh of S.shifts) {
    const g = shiftGeom(sh);
    const opts = TAGS.map(([v, l]) => `<option value="${v}"${sh.tag === v ? ' selected' : ''}>${l}</option>`).join('');
    rows += `<tr>
      <td><button class="icon-button" type="button" data-act="color" data-id="${sh.id}" title="Change colour" aria-label="Change colour of ${esc(sh.name)}"><span class="swatch swatch-shift ${shiftClass(sh)}"></span></button></td>
      <td><input class="input input-md" type="text" id="shn-${sh.id}" data-shift="${sh.id}" data-f="name" value="${esc(sh.name)}" aria-label="Shift name"></td>
      <td><input class="input input-xs mono" type="text" id="shc-${sh.id}" data-shift="${sh.id}" data-f="code" value="${esc(sh.code)}" maxlength="2" aria-label="Code"></td>
      <td><input class="input input-sm" type="time" id="shs-${sh.id}" data-shift="${sh.id}" data-f="start" value="${esc(sh.start)}" aria-label="Start"></td>
      <td><input class="input input-sm" type="time" id="she-${sh.id}" data-shift="${sh.id}" data-f="end" value="${esc(sh.end)}" aria-label="End"></td>
      <td class="num"><input class="input input-sm input-num" type="number" min="0" step="5" id="shb-${sh.id}" data-shift="${sh.id}" data-f="brk" value="${esc(sh.brk || 0)}" aria-label="Break minutes"></td>
      <td class="num">${fmtH(g.paid)}</td>
      <td><select class="input input-md" id="sht-${sh.id}" data-shift="${sh.id}" data-f="tag" aria-label="Shift type">${opts}</select></td>
      <td class="cell-right">${removeButton('del-shift', sh.id, sh.name)}</td>
    </tr>`;
  }
  return `<section class="span-4 card stack-1">
    <h2 class="heading">Shift types</h2>
    <p class="hint">Set default times and mark each shift as desirable, neutral or undesirable. Overnight shifts that end after midnight are handled automatically.</p>
    <div class="scroll"><table class="table"><thead><tr><th></th><th>Name</th><th>Code</th><th>Start</th><th>End</th><th class="num">Break min</th><th class="num">Paid h</th><th>Type</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <div class="button-row"><button class="button" type="button" data-act="add-shift">Add shift type</button></div>
  </section>`;
}

function weeklyNeeds(S) {
  let rows = '';
  for (const sh of S.shifts) {
    const n = S.needs[sh.id] || [0, 0, 0, 0, 0, 0, 0];
    const cells = WEEK.map((w) => `<td><input class="input input-xs input-num" type="number" min="0" id="nd-${sh.id}-${w}" data-need="${sh.id}" data-dow="${w}" value="${+n[w] || 0}" aria-label="${esc(sh.name)} ${DOW[w]}"></td>`).join('');
    rows += `<tr><td class="cell-left"><span class="swatch swatch-shift ${shiftClass(sh)}"></span> ${esc(sh.name)}</td>${cells}</tr>`;
  }
  return `<section class="span-4 md-span-2 card stack-1">
    <h2 class="heading">Default staff needed</h2>
    <p class="hint">How many people each shift needs on a normal week. Use the calendar below to change single days, such as public holidays.</p>
    <div class="scroll"><table class="table table-center"><thead><tr><th>Shift</th>${WEEK.map((w) => `<th>${DOW[w]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function positionNeeds(S) {
  const pos = positions(S);
  let body;
  if (!pos.length) {
    body = `<p class="empty">Nobody has a position yet. Give people a position on the Staff tab, then set here how many each shift needs.</p>`;
  } else {
    let rows = '';
    for (const sh of S.shifts) {
      pos.forEach((p, i) => {
        const n = ((S.posNeeds || {})[sh.id] || {})[p.key] || [];
        const cells = WEEK.map((w) => `<td><input class="input input-xs input-num" type="number" min="0" id="pn-${sh.id}-${i}-${w}" data-pneed="${sh.id}" data-pos="${esc(p.key)}" data-dow="${w}" value="${+n[w] || 0}" aria-label="${esc(p.name)} on ${esc(sh.name)} ${DOW[w]}"></td>`).join('');
        rows += `<tr><td class="cell-left"><span class="swatch swatch-shift ${shiftClass(sh)}"></span> ${esc(sh.name)}</td><td class="cell-left">${esc(p.name)}</td>${cells}</tr>`;
      });
    }
    body = `<div class="scroll"><table class="table table-center"><thead><tr><th>Shift</th><th>Position</th>${WEEK.map((w) => `<th>${DOW[w]}</th>`).join('')}</tr></thead><tbody>${rows}</tbody></table></div>`;
  }
  return `<section class="span-4 card stack-1">
    <h2 class="heading">Positions needed</h2>
    <p class="hint">The least number of people of a position on each shift, per weekday. They are part of the staff needed above, not extra, so a number higher than the shift's headcount is cut to fit. 0 means anyone can fill the shift.</p>
    ${body}
  </section>`;
}

function monthCalendar(S, C) {
  const hasOverrides = Object.keys(S.overrides).some((k) => k.startsWith(S.month));
  let rows = '';
  for (const sh of S.shifts) {
    rows += `<tr><td class="mono">${esc(sh.code)}</td>`;
    for (const d of C.days) {
      const o = S.overrides[d.date];
      const isOv = !!(o && o[sh.id] != null);
      rows += `<td class="${d.we ? 'is-weekend' : ''}"><input class="input input-xs input-num${isOv ? ' is-override' : ''}" type="number" min="0" id="ov-${sh.id}-${d.date}" data-ov="${sh.id}" data-date="${d.date}" value="${C.need(d, sh)}" aria-label="${esc(sh.name)} ${d.date}"></td>`;
    }
    rows += `</tr>`;
  }
  const head = C.days.map((d) => `<th class="${d.we ? 'is-weekend' : ''} mono">${DOW[d.dow].slice(0, 2)}<br>${d.day}</th>`).join('');
  return `<section class="span-4 card stack-1">
    <h2 class="heading">Staff needed in ${monthName(S.month)}</h2>
    <p class="hint">Highlighted cells differ from the weekly default. Set a cell back to the default value to remove the change.</p>
    ${hasOverrides ? `<div class="button-row"><button class="button button-sm" type="button" data-act="reset-ov">Reset this month to defaults</button></div>` : ''}
    <div class="scroll"><table class="table table-center"><thead><tr><th>Shift</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
  </section>`;
}

function rules(S) {
  const st = S.settings;
  return `<section class="span-4 md-span-2 card stack-2">
    <h2 class="heading">Rules</h2>
    <div class="form-row">
      <div class="field"><label class="label" for="r-rest">Min rest between shifts (h)</label><input class="input input-sm input-num" type="number" min="0" max="24" id="r-rest" data-set="minRest" value="${st.minRest}"></div>
      <div class="field"><label class="label" for="r-cons">Max days in a row</label><input class="input input-sm input-num" type="number" min="1" max="31" id="r-cons" data-set="maxConsec" value="${st.maxConsec}"></div>
    </div>
    <label class="toggle"><input type="checkbox" id="r-we" data-set="weekendUndesirable"${st.weekendUndesirable ? ' checked' : ''}><span>Count weekend shifts as undesirable<br><span class="text-muted">They are then shared out fairly like night shifts.</span></span></label>
    <label class="toggle"><input type="checkbox" id="r-lv" data-set="leaveReduces"${st.leaveReduces ? ' checked' : ''}><span>Reduce monthly hours for leave days<br><span class="text-muted">A week of leave lowers that person's target by about a quarter.</span></span></label>
  </section>`;
}

export function renderShifts(S) {
  const C = ctx(S);
  // Desktop: default needs and rules sit side by side above the month calendar.
  return shiftTypes(S) + weeklyNeeds(S) + rules(S) + positionNeeds(S) + monthCalendar(S, C);
}
