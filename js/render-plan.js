// Rota screen: capacity banner, the month grid, legend and fairness table.
import { ctx, evaluate, reqMet } from './schedule.js';
import { DOW, esc, fmtH, monthName, reqText, shiftClass } from './util.js';
import { emptyScreen } from './render-shared.js';

const fmtWhen = (iso) =>
  new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function renderPlan(S, ui) {
  const C = ctx(S);
  if (!S.staff.length) {
    return emptyScreen(
      'No staff yet',
      'Add your team on the Staff tab, set up shifts and how many people each day needs, then come back here to generate the rota.',
      '#/staff',
      'Add staff',
    );
  }
  const hasPlan = !!(S.plan && S.plan.month === S.month);
  const cells = hasPlan ? S.plan.cells : {};
  const E = evaluate(C, cells);
  const shById = Object.fromEntries(C.shifts.map((s) => [s.id, s]));
  let out = '';

  // Capacity banner
  const capH = C.sumT;
  const diff = capH - C.needH;
  let cap = `Staffing needs <b class="mono">${fmtH(C.needH)} h</b> (${C.needSlots} shifts) this month. Your team's targets add up to <b class="mono">${fmtH(capH)} h</b>${S.settings.leaveReduces ? ' after leave.' : '.'}`;
  if (Math.abs(diff) > C.avgPaid) {
    cap += diff < 0
      ? ` That is <b>${fmtH(-diff)} h short</b>, so some people will go over their hours or some shifts stay unfilled.`
      : ` That leaves <b>${fmtH(diff)} h</b> spare, so most people will finish under their target.`;
  }
  out += `<div class="span-4 banner${diff < -C.avgPaid ? ' banner-warn' : ''}"><span>${cap}</span></div>`;

  // Month card with actions
  const nIssues = Object.keys(E.issues).length;
  const nShort = Object.values(E.cover).reduce((a, c) => a + c.short, 0);
  const nPos = Object.values(E.cover).reduce((a, c) => a + c.posShort, 0);
  let genLabel = 'Generate rota';
  if (hasPlan) genLabel = S.plan.edited && ui.confirmRegen ? 'Overwrite my edits?' : 'Regenerate rota';
  const hint = hasPlan
    ? `Generated ${fmtWhen(S.plan.generatedAt)}, best of ${S.plan.runs} attempts${S.plan.edited ? ', with manual edits' : ''}. Tap any cell to change it.`
    : 'No rota yet for this month. Generate one, then fine-tune by tapping cells.';
  out += `<section class="span-4 card stack-1">
    <h2 class="heading">${monthName(S.month)}</h2>
    <p class="hint">${hint}</p>
    <div class="button-row">
      <button class="button button-primary" type="button" id="gen" data-act="generate">${genLabel}</button>
      ${hasPlan ? `<button class="button" type="button" data-act="export">Export CSV</button><button class="button" type="button" data-act="copy">Copy table</button>` : ''}
    </div>
  </section>`;

  if (hasPlan && (nIssues || nShort || nPos)) {
    let msg = '';
    if (nShort) msg += `<b>${nShort} shift${nShort > 1 ? 's' : ''} unfilled.</b> `;
    if (nPos) msg += `<b>${nPos} place${nPos > 1 ? 's' : ''} not covered by the required position.</b> See the Cover row. `;
    if (nIssues) msg += `<b>${nIssues} rule conflict${nIssues > 1 ? 's' : ''}</b> marked in red (leave, rest time or days in a row).`;
    if (nShort && !nIssues && !nPos) msg += 'Not enough available people. Check leave, rest time or add staff.';
    out += `<div class="span-4 banner banner-bad"><span>${msg}</span></div>`;
  }

  // Rota grid (full-bleed, scrolls)
  out += `<div class="span-4 full-bleed rota-frame"><table class="rota"><thead><tr><th class="rota-name" scope="col">Staff</th>`;
  for (const d of C.days) {
    out += `<th class="${d.we ? 'is-weekend' : ''}" scope="col"><span class="rota-dow">${DOW[d.dow].slice(0, 2)}</span>${d.day}</th>`;
  }
  out += `<th class="rota-total" scope="col">Hours</th></tr></thead><tbody>`;

  for (const s of S.staff) {
    const position = String(s.position || '').trim();
    out += `<tr><th class="rota-name" scope="row" title="${esc(position ? `${s.name} · ${position}` : s.name)}">${esc(s.name)}${position ? `<span class="rota-name-position">${esc(position)}</span>` : ''}</th>`;
    for (const d of C.days) {
      const key = `${s.id}|${d.date}`;
      const sh = shById[cells[key]];
      const lv = C.leave[s.id].has(d.date);
      const rs = C.req[key];
      const tip = [];
      let dot = '';
      if (rs) {
        const met = rs.every((r) => reqMet(r, cells[key]));
        dot = `<span class="rota-req ${hasPlan ? (met ? 'is-met' : 'is-unmet') : 'is-pending'}"></span>`;
        for (const r of rs) {
          tip.push(`Request: ${reqText(S, r)}${hasPlan ? (reqMet(r, cells[key]) ? ' (met)' : ' (not met)') : ''}`);
        }
      }
      const blocked = !lv && C.blockedDay(s.id, d.date);
      if (lv) tip.push('On leave');
      if (blocked) tip.push('Fixed day off');
      if (sh) tip.unshift(`${sh.name} ${sh.start}–${sh.end}`);
      const iss = E.issues[key];
      if (iss) tip.push(...iss);
      const cls = [
        'rota-cell', d.we ? 'is-weekend' : '', lv && !sh ? 'is-leave' : '', blocked && !sh ? 'is-blocked' : '', iss ? 'is-issue' : '',
      ].filter(Boolean).join(' ');
      let inner = '';
      if (sh) inner = `<span class="rota-tag ${shiftClass(sh)}">${esc(sh.code)}</span>`;
      else if (lv) inner = 'Lv';
      const title = `${d.day} ${DOW[d.dow]}${tip.length ? ` · ${tip.join(' · ')}` : ''}`;
      let state = 'off';
      if (sh) state = sh.name;
      else if (lv) state = 'leave';
      else if (blocked) state = 'fixed day off';
      const label = `${s.name}, ${d.date}: ${state}`;
      out += `<td><button class="${cls}" type="button" id="c-${esc(key)}" data-cell="${esc(key)}" title="${esc(title)}" aria-label="${esc(label)}">${inner}${dot}</button></td>`;
    }
    const p = E.per[s.id];
    const dd = p.h - C.target[s.id];
    let dcls = '';
    if (Math.abs(dd) > C.avgPaid) dcls = Math.abs(dd) > C.avgPaid * 2 ? ' delta-bad' : ' delta-warn';
    out += `<td class="rota-total${dcls}">${fmtH(p.h)}</td></tr>`;
  }

  out += `</tbody><tfoot><tr><th class="rota-name" scope="row">Cover</th>`;
  for (const d of C.days) {
    const c = E.cover[d.date];
    const shortBy = Object.entries(c.by)
      .filter(([, v]) => v.have < v.need)
      .map(([k, v]) => `${shById[k].code} −${v.need - v.have}`);
    const posBy = [];
    for (const [k, v] of Object.entries(c.by)) {
      for (const p of v.pos) if (p.have < p.need) posBy.push(`${shById[k].code} ${p.have} of ${p.need} ${p.name}`);
    }
    const cls = c.short || c.posShort ? 'is-short' : c.have > c.need ? 'is-over' : '';
    const title = `${c.have} of ${c.need} filled${shortBy.length ? ` · short: ${shortBy.join(', ')}` : ''}${posBy.length ? ` · position missing: ${posBy.join(', ')}` : ''}`;
    let text = String(c.need);
    if (hasPlan) text = c.short ? `−${c.short}` : `${c.have}/${c.need}`;
    out += `<td class="${cls}" title="${esc(title)}">${text}</td>`;
  }
  out += `<td></td></tr></tfoot></table></div>`;

  // Legend
  out += `<div class="span-4 legend">`;
  for (const sh of C.shifts) {
    out += `<span class="legend-item"><span class="swatch swatch-soft ${shiftClass(sh)}"></span><b class="mono">${esc(sh.code)}</b> ${esc(sh.name)} ${esc(sh.start)}–${esc(sh.end)}</span>`;
  }
  out += `<span class="legend-item"><span class="swatch swatch-good"></span>Request met</span>`;
  out += `<span class="legend-item"><span class="swatch swatch-bad"></span>Request not met</span>`;
  out += `<span class="legend-item"><span class="swatch swatch-outline"></span>Rule conflict</span>`;
  out += `<span class="legend-item"><span class="swatch swatch-hatched"></span>Leave or fixed day off</span></div>`;

  // Fairness
  out += `<section class="span-4 card stack-1">
    <h2 class="heading">Fairness</h2>
    <p class="hint">Undesirable and desirable shifts are shared in proportion to each person's hours. ${S.settings.weekendUndesirable ? 'Weekend shifts count as undesirable.' : ''}</p>
    <div class="scroll"><table class="table"><thead><tr><th>Staff</th><th class="num">Target h</th><th class="num">Planned h</th><th>Progress</th><th class="num">Diff</th><th class="num">Shifts</th><th class="num">Undesirable</th><th class="num">Desirable</th><th class="num">Requests met</th></tr></thead><tbody>`;
  const BAR_MAX = 130; // the bar shows up to 130 % of target
  for (const s of S.staff) {
    const p = E.per[s.id];
    const t = C.target[s.id];
    const dd = p.h - t;
    const pct = t ? Math.min(BAR_MAX, (p.h / t) * 100) : 0;
    const dcls = Math.abs(dd) <= C.avgPaid ? 'delta-good' : Math.abs(dd) <= C.avgPaid * 2 ? 'delta-warn' : 'delta-bad';
    const fu = Math.abs(p.u - C.expU[s.id]) < 1.5 ? '' : ' delta-warn';
    const fd = Math.abs(p.d - C.expD[s.id]) < 1.5 ? '' : ' delta-warn';
    const contracted = +s.hours || 0;
    out += `<tr><td>${esc(s.name)}</td>
      <td class="num">${fmtH(t)}${t !== contracted ? `<span class="text-muted"> / ${fmtH(contracted)}</span>` : ''}</td>
      <td class="num">${fmtH(p.h)}</td>
      <td><div class="bar" title="${Math.round(pct)}% of target"><i class="bar-fill" style="width:${(pct / BAR_MAX) * 100}%"></i><b class="bar-mark" style="left:${(100 / BAR_MAX) * 100}%"></b></div></td>
      <td class="num ${dcls}">${dd > 0 ? '+' : ''}${fmtH(dd)}</td>
      <td class="num">${p.n}</td>
      <td class="num${fu}">${p.u} <span class="text-muted">/ ${fmtH(C.expU[s.id])}</span></td>
      <td class="num${fd}">${p.d} <span class="text-muted">/ ${fmtH(C.expD[s.id])}</span></td>
      <td class="num">${p.reqT ? `${p.reqM} of ${p.reqT}` : '<span class="text-muted">–</span>'}</td></tr>`;
  }
  out += `</tbody></table></div>
    <p class="hint">Grey numbers after a slash show the fair share. Target hours shown as "x / y" have been reduced for leave days.</p>
  </section>`;
  return out;
}
