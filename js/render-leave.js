// Leave screen: leave periods (hard) and shift requests (soft).
import { reqMet } from './schedule.js';
import { DOW, WEEK, esc, fmtDate, monthDays, monthName, reqText, ruleDays, ruleOnDow, staffName } from './util.js';
import { emptyScreen, removeButton } from './render-shared.js';

export function renderLeave(S) {
  if (!S.staff.length) {
    return emptyScreen('Leave & requests', 'Add staff first, then record their leave and shift wishes here.', '#/staff', 'Add staff');
  }
  const m = S.month;
  const days = monthDays(m);
  const first = days[0].date;
  const last = days[days.length - 1].date;
  const monthShort = monthName(m).split(' ')[0];
  const staffOpts = S.staff.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  const shiftOpts = S.shifts.map((s) => `<option value="${s.id}">${esc(s.name)}</option>`).join('');
  const hasPlan = !!(S.plan && S.plan.month === m);

  const leave = [...S.leave].sort((a, b) => a.from.localeCompare(b.from));
  const leaveList = leave.length
    ? leave.map((l) => {
      const n = days.filter((d) => d.date >= l.from && d.date <= l.to).length;
      return `<div class="list-item">
        <div class="list-item-main"><b>${esc(staffName(S, l.staffId))}</b> <span class="text-muted">${fmtDate(l.from)}${l.to !== l.from ? ` – ${fmtDate(l.to)}` : ''}${l.note ? ` · ${esc(l.note)}` : ''}</span></div>
        <span class="chip ${n ? 'chip-w' : 'chip-n'}">${n} day${n === 1 ? '' : 's'} in ${monthShort}</span>
        ${removeButton('del-leave', l.id, 'leave')}
      </div>`;
    }).join('')
    : `<div class="empty">No leave recorded.</div>`;

  const reqs = [...S.requests].sort((a, b) => a.date.localeCompare(b.date));
  const reqList = reqs.length
    ? reqs.map((r) => {
      const inMonth = r.date.startsWith(m);
      let chip = '';
      if (!inMonth) chip = `<span class="chip chip-n">Other month</span>`;
      else if (hasPlan) chip = reqMet(r, S.plan.cells[`${r.staffId}|${r.date}`]) ? `<span class="chip chip-d">Met</span>` : `<span class="chip chip-u">Not met</span>`;
      return `<div class="list-item">
        <div class="list-item-main"><b>${esc(staffName(S, r.staffId))}</b> <span class="text-muted">${fmtDate(r.date)} · ${esc(reqText(S, r))}</span></div>
        ${chip}
        ${removeButton('del-req', r.id, 'request')}
      </div>`;
    }).join('')
    : `<div class="empty">No requests yet.</div>`;

  // Recurring rules, with "x of y met" for soft rules once a plan exists
  const rules = [...(S.recurring || [])].sort((a, b) => staffName(S, a.staffId).localeCompare(staffName(S, b.staffId)));
  const ruleList = rules.length
    ? rules.map((r) => {
      const soft = !r.strict || r.kind === 'want';
      let chip = r.strict && !soft ? `<span class="chip chip-w">Fixed</span>` : '';
      if (soft) {
        chip = `<span class="chip chip-n">Wish</span>`;
        if (hasPlan) {
          const applies = days.filter((d) => ruleOnDow(r, d.dow));
          const met = applies.filter((d) => reqMet(r, S.plan.cells[`${r.staffId}|${d.date}`])).length;
          chip += met === applies.length
            ? `<span class="chip chip-d">${met} of ${applies.length} met</span>`
            : `<span class="chip chip-u">${met} of ${applies.length} met</span>`;
        }
      }
      return `<div class="list-item">
        <div class="list-item-main"><b>${esc(staffName(S, r.staffId))}</b> <span class="text-muted">${ruleDays(r)} · ${esc(reqText(S, { kind: r.kind, shiftId: r.shiftId }))}</span></div>
        ${chip}
        ${removeButton('del-rule', r.id, 'rule')}
      </div>`;
    }).join('')
    : `<div class="empty">No recurring requests yet.</div>`;
  const dowOpts = `<option value="">Any day</option>${WEEK.map((w) => `<option value="${w}">Every ${DOW[w]}</option>`).join('')}`;

  const recurringCard = `<section class="span-4 card stack-1">
    <h2 class="heading">Recurring requests</h2>
    <p class="hint">Standing wishes that apply every week, such as never on Mondays or no night shifts. Tick <b>Fixed</b> for rules that must never be broken; otherwise the planner treats them like requests. Leave still wins over everything.</p>
    <form class="form-row" id="add-rule">
      <div class="field field-grow"><label class="label" for="rr-s">Person</label><select class="input" id="rr-s">${staffOpts}</select></div>
      <div class="field"><label class="label" for="rr-d">Every</label><select class="input input-md" id="rr-d">${dowOpts}</select></div>
      <div class="field field-grow"><label class="label" for="rr-k">Request</label><select class="input" id="rr-k"><option value="off">Day off</option><option value="want">Wants to work</option><option value="avoid">Avoid shift</option></select></div>
      <div class="field field-grow"><label class="label" for="rr-sh">Shift</label><select class="input" id="rr-sh"><option value="">Any shift</option>${shiftOpts}</select></div>
      <label class="toggle toggle-inline"><input type="checkbox" id="rr-x"><span>Fixed<br><span class="text-muted">never broken</span></span></label>
      <button class="button button-primary button-block" type="submit">Add rule</button>
    </form>
    <div class="list">${ruleList}</div>
  </section>`;

  return `<section class="span-4 md-span-2 card stack-1">
    <h2 class="heading">Leave</h2>
    <p class="hint">People on leave are never scheduled on those days.</p>
    <form class="form-row" id="add-leave">
      <div class="field field-grow"><label class="label" for="lv-s">Person</label><select class="input" id="lv-s">${staffOpts}</select></div>
      <div class="field"><label class="label" for="lv-f">From</label><input class="input input-md" type="date" id="lv-f" value="${first}" required></div>
      <div class="field"><label class="label" for="lv-t">To</label><input class="input input-md" type="date" id="lv-t" value="${first}" required></div>
      <div class="field field-grow"><label class="label" for="lv-n">Note</label><input class="input" type="text" id="lv-n" placeholder="Holiday, training…"></div>
      <button class="button button-primary button-block" type="submit">Add leave</button>
    </form>
    <div class="list">${leaveList}</div>
  </section>
  <section class="span-4 md-span-2 card stack-1">
    <h2 class="heading">Requests</h2>
    <p class="hint">Wishes the planner tries to meet. Unlike leave they can be overruled when nobody else is available.</p>
    <form class="form-row" id="add-req">
      <div class="field field-grow"><label class="label" for="rq-s">Person</label><select class="input" id="rq-s">${staffOpts}</select></div>
      <div class="field"><label class="label" for="rq-d">Date</label><input class="input input-md" type="date" id="rq-d" value="${first}" min="${first}" max="${last}" required></div>
      <div class="field field-grow"><label class="label" for="rq-k">Request</label><select class="input" id="rq-k"><option value="off">Day off</option><option value="want">Wants to work</option><option value="avoid">Avoid shift</option></select></div>
      <div class="field field-grow"><label class="label" for="rq-sh">Shift</label><select class="input" id="rq-sh"><option value="">Any shift</option>${shiftOpts}</select></div>
      <button class="button button-primary button-block" type="submit">Add request</button>
    </form>
    <div class="list">${reqList}</div>
  </section>${recurringCard}`;
}
