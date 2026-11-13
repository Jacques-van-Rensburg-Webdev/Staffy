// Staff screen: the team table and the add-person form.
import { ctx } from './schedule.js';
import { esc, fmtH, monthName, positions } from './util.js';
import { removeButton } from './render-shared.js';

export function renderStaff(S) {
  const C = ctx(S);
  // Suggestions for the position fields: positions already in use.
  const posOptions = positions(S).map((x) => `<option value="${esc(x.name)}"></option>`).join('');
  let rows = '';
  if (!S.staff.length) rows = `<tr><td colspan="6" class="empty">No staff yet. Add the first person below.</td></tr>`;
  for (const s of S.staff) {
    rows += `<tr>
      <td><input class="input input-md" type="text" id="sn-${s.id}" data-staff="${s.id}" data-f="name" value="${esc(s.name)}" aria-label="Name"></td>
      <td><input class="input input-md" type="text" list="pos-list" id="sp-${s.id}" data-staff="${s.id}" data-f="position" value="${esc(s.position)}" placeholder="None" aria-label="Position"></td>
      <td class="num"><input class="input input-sm input-num" type="number" min="0" step="1" id="sh-${s.id}" data-staff="${s.id}" data-f="hours" value="${esc(s.hours)}" aria-label="Hours per month"></td>
      <td class="num">${C.leave[s.id].size || '–'}</td>
      <td class="num">${fmtH(C.target[s.id])} h</td>
      <td class="cell-right">${removeButton('del-staff', s.id, s.name)}</td>
    </tr>`;
  }
  return `<section class="span-4 md-span-2 card stack-1">
    <h2 class="heading">Staff</h2>
    <p class="hint">Monthly hours are each person's contracted hours. The planner aims to give everyone close to this, reduced for leave days if that rule is on. A position (such as Nurse) is optional; on the Shifts tab you can say how many people of a position each shift needs.</p>
    <datalist id="pos-list">${posOptions}</datalist>
    <div class="scroll"><table class="table"><thead><tr><th>Name</th><th>Position</th><th class="num">Hours / month</th><th class="num">Leave days</th><th class="num">Target this month</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>
    <p class="hint">Total target: <b class="mono">${fmtH(C.sumT)} h</b> · Shifts need: <b class="mono">${fmtH(C.needH)} h</b> in ${monthName(S.month)}.</p>
  </section>
  <section class="span-4 md-span-2 card stack-1">
    <h2 class="heading">Add person</h2>
    <form class="form-row" id="add-staff">
      <div class="field field-grow"><label class="label" for="ns-name">Name</label><input class="input" type="text" id="ns-name" required placeholder="e.g. Jana Schulz"></div>
      <div class="field field-grow"><label class="label" for="ns-pos">Position (optional)</label><input class="input" type="text" list="pos-list" id="ns-pos" placeholder="e.g. Nurse"></div>
      <div class="field"><label class="label" for="ns-hours">Hours / month</label><input class="input input-sm input-num" type="number" id="ns-hours" min="0" value="160"></div>
      <button class="button button-primary button-block" type="submit">Add person</button>
    </form>
  </section>`;
}
