// Rota screen, calendar view: month calendar, the "moving" bar and the open day's card.
import { DOW, WEEK, esc, fmtDateLong, shiftClass, staffName } from './util.js';

const initials = (name) => {
  const parts = String(name).trim().split(/\s+/);
  return ((parts[0] || '')[0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '');
};
const firstName = (name) => String(name).trim().split(/\s+/)[0] || '';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

// People working on a day, in shift order then staff order: [{ s, sh, key, issues }].
function working(S, C, E, cells, date) {
  const out = [];
  for (const sh of C.shifts) {
    for (const s of S.staff) {
      const key = `${s.id}|${date}`;
      if (cells[key] === sh.id) out.push({ s, sh, key, issues: E.issues[key] });
    }
  }
  return out;
}

function dayCell(S, C, E, cells, hasPlan, ui, d) {
  const people = working(S, C, E, cells, d.date);
  const c = E.cover[d.date];
  const nIssues = people.filter((p) => p.issues).length;
  const bad = hasPlan && (c.short || c.posShort || nIssues);
  const notes = [`${c.have} of ${plural(c.need, 'place')} filled`];
  if (hasPlan && c.posShort) notes.push(`${plural(c.posShort, 'place')} missing a required position`);
  if (nIssues) notes.push(plural(nIssues, 'rule conflict'));
  let flag = '';
  if (hasPlan && c.short) flag = `−${c.short}`;
  else if (bad) flag = '!';
  const cls = [
    'cal-day', bad ? 'is-bad' : '', ui.day === d.date ? 'is-open' : '',
    ui.move && ui.move.date === d.date ? 'is-origin' : '',
  ].filter(Boolean).join(' ');
  const label = ui.move
    ? `Move the shift to ${fmtDateLong(d.date)}`
    : `${fmtDateLong(d.date)}: ${notes.join(', ')}`;
  let tags = '';
  for (const p of people) {
    const moving = ui.move && ui.move.staffId === p.s.id && ui.move.date === d.date;
    tags += `<span class="cal-tag ${shiftClass(p.sh)}${p.issues ? ' is-issue' : ''}${moving ? ' is-moving' : ''}" draggable="true" data-drag="${esc(p.key)}" title="${esc(`${p.s.name} · ${p.sh.name} ${p.sh.start}–${p.sh.end}`)}"><span class="cal-tag-short">${esc(initials(p.s.name))}</span><span class="cal-tag-long">${esc(firstName(p.s.name))}</span></span>`;
  }
  return `<td class="${d.we ? 'is-weekend' : ''}"><div class="${cls}" data-day="${d.date}">
    <button class="cal-day-button" type="button" id="cd-${d.date}" aria-label="${esc(label)}" title="${esc(notes.join(' · '))}"${ui.day === d.date ? ' aria-expanded="true"' : ''}></button>
    <span class="cal-date"><span>${d.day}</span>${flag ? `<span class="cal-flag">${flag}</span>` : ''}</span>
    <span class="cal-tags">${tags}</span>
  </div></td>`;
}

function calendar(S, C, E, cells, hasPlan, ui) {
  let rows = '';
  let row = '';
  const lead = WEEK.indexOf(C.days[0].dow);
  for (let i = 0; i < lead; i += 1) row += '<td class="cal-blank"></td>';
  for (const d of C.days) {
    row += dayCell(S, C, E, cells, hasPlan, ui, d);
    if (d.dow === 0) { rows += `<tr>${row}</tr>`; row = ''; }
  }
  if (row) {
    const used = WEEK.indexOf(C.days[C.N - 1].dow) + 1;
    for (let i = used; i < 7; i += 1) row += '<td class="cal-blank"></td>';
    rows += `<tr>${row}</tr>`;
  }
  const head = WEEK.map((w) => `<th scope="col" class="${w === 0 || w === 6 ? 'is-weekend' : ''}">${DOW[w].slice(0, 2)}</th>`).join('');
  return `<div class="span-4 full-bleed cal-frame"><table class="cal${ui.move ? ' is-moving' : ''}" id="cal"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>`;
}

function movingBar(S, C, cells, ui) {
  const sh = C.shifts.find((x) => x.id === cells[`${ui.move.staffId}|${ui.move.date}`]);
  return `<div class="span-4 banner" id="cal-moving" role="status"><span>Moving <b>${esc(staffName(S, ui.move.staffId))}</b>'s ${esc(sh ? sh.name : '')} shift from ${fmtDateLong(ui.move.date)}. <b>Tap the new day.</b></span><button class="button button-sm" type="button" data-cal="cancel">Cancel</button></div>`;
}

function dayCard(S, C, E, cells, hasPlan, date) {
  const people = working(S, C, E, cells, date);
  const cover = E.cover[date];
  let body = '';
  for (const sh of C.shifts) {
    const on = people.filter((p) => p.sh.id === sh.id);
    const by = cover.by[sh.id];
    if (!by.need && !on.length) continue;
    let chips = '';
    if (hasPlan && by.have < by.need) chips += `<span class="chip chip-u">${by.need - by.have} unfilled</span>`;
    if (hasPlan) {
      for (const p of by.pos) if (p.have < p.need) chips += `<span class="chip chip-u">${p.have} of ${p.need} ${esc(p.name)}</span>`;
    }
    body += `<h3 class="day-shift"><span class="swatch swatch-shift ${shiftClass(sh)}"></span><span>${esc(sh.name)} <span class="mono text-muted">${esc(sh.start)}–${esc(sh.end)}</span></span><span class="mono text-muted">${by.have}/${by.need}</span>${chips}</h3>`;
    if (!on.length) { body += `<p class="empty">Nobody on this shift.</p>`; continue; }
    body += `<div class="list">`;
    for (const p of on) {
      const position = String(p.s.position || '').trim();
      const msgs = (p.issues || []).map((m) => `<span class="day-issue">${esc(m)}</span>`).join('');
      body += `<div class="list-item"><span class="list-item-main"><b>${esc(p.s.name)}</b>${position ? ` <span class="text-muted">${esc(position)}</span>` : ''}${msgs}</span>
        <button class="button" type="button" id="mv-${esc(p.key)}" data-cal="move" data-key="${esc(p.key)}" aria-label="Move ${esc(p.s.name)}'s ${esc(sh.name)} shift to another day">Move</button>
        <button class="button" type="button" id="dc-${esc(p.key)}" data-cell="${esc(p.key)}" aria-label="Change ${esc(p.s.name)}'s shift on this day">Change</button></div>`;
    }
    body += `</div>`;
  }
  if (!body) body = `<p class="empty">No shifts need staff on this day.</p>`;

  // Everyone else, so a free person can be given a shift from here too.
  let rest = '';
  for (const s of S.staff) {
    const key = `${s.id}|${date}`;
    if (cells[key]) continue;
    let why = 'Off';
    if (C.leave[s.id].has(date)) why = 'On leave';
    else if (C.blockedDay(s.id, date)) why = 'Fixed day off';
    rest += `<div class="list-item"><span class="list-item-main">${esc(s.name)} <span class="text-muted">${why}</span></span>
      <button class="button" type="button" id="dc-${esc(key)}" data-cell="${esc(key)}" aria-label="Give ${esc(s.name)} a shift on this day">Assign</button></div>`;
  }
  return `<section class="span-4 card stack-1" id="cal-daycard">
    <div class="day-head"><h2 class="heading">${fmtDateLong(date)}</h2><button class="button button-sm" type="button" data-cal="close">Close</button></div>
    ${body}
    ${rest ? `<h3 class="day-shift"><span>Not working</span></h3><div class="list">${rest}</div>` : ''}
  </section>`;
}

export function renderCalendar(S, C, E, cells, hasPlan, ui) {
  const open = ui.day && ui.day.startsWith(S.month) ? ui.day : null;
  const moving = ui.move && cells[`${ui.move.staffId}|${ui.move.date}`] ? ui.move : null;
  const view = { day: open, move: moving };
  let out = moving ? movingBar(S, C, cells, view) : '';
  out += calendar(S, C, E, cells, hasPlan, view);
  if (!moving && !open) out += `<p class="span-4 hint">Tap a day to see its shifts and to move or change them.</p>`;
  if (open) out += dayCard(S, C, E, cells, hasPlan, open);
  return out;
}
