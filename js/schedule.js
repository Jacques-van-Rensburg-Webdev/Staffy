// Scheduling: month context, the greedy generator with random restarts, and plan checks.
import { monthDays, shiftGeom, fmtH, ruleOnDow, ruleText, posKey, positions } from './util.js';

// Everything the generator and the screens need to know about a month.
export function ctx(st) {
  const days = monthDays(st.month);
  const N = days.length;
  const shifts = st.shifts.map((sh) => ({ ...sh, ...shiftGeom(sh) }));

  const leave = {};
  for (const s of st.staff) leave[s.id] = new Set();
  for (const l of st.leave) {
    if (!leave[l.staffId]) continue;
    for (const d of days) if (d.date >= l.from && d.date <= (l.to || l.from)) leave[l.staffId].add(d.date);
  }

  const need = (d, sh) => {
    const o = st.overrides[d.date];
    if (o && o[sh.id] != null) return +o[sh.id] || 0;
    return +((st.needs[sh.id] || [])[d.dow]) || 0;
  };
  // Places on a shift kept for a position: [{ key, name, n }]. They count within the headcount.
  const posList = positions(st);
  const staffPos = {};
  for (const s of st.staff) staffPos[s.id] = posKey(s.position);
  const posNeed = (d, sh) => {
    const byPos = (st.posNeeds || {})[sh.id];
    if (!byPos) return [];
    let left = need(d, sh);
    const out = [];
    for (const p of posList) {
      const n = Math.min(left, +((byPos[p.key] || [])[d.dow]) || 0);
      if (n > 0) { out.push({ ...p, n }); left -= n; }
    }
    return out;
  };
  const cls = (d, sh) => {
    if (sh.tag === 'u' || (st.settings.weekendUndesirable && d.we)) return 'u';
    if (sh.tag === 'd') return 'd';
    return 'n';
  };

  const target = {};
  let sumT = 0;
  for (const s of st.staff) {
    const h = +s.hours || 0;
    const avail = N - leave[s.id].size;
    target[s.id] = st.settings.leaveReduces ? (h * avail) / N : h;
    sumT += target[s.id];
  }

  let totU = 0; let totD = 0; let needH = 0; let needSlots = 0;
  for (const d of days) {
    for (const sh of shifts) {
      const n = need(d, sh);
      needSlots += n;
      needH += n * sh.paid;
      const c = cls(d, sh);
      if (c === 'u') totU += n;
      else if (c === 'd') totD += n;
    }
  }

  const expU = {}; const expD = {};
  for (const s of st.staff) {
    const f = sumT ? target[s.id] / sumT : 1 / Math.max(1, st.staff.length);
    expU[s.id] = totU * f;
    expD[s.id] = totD * f;
  }

  // Requests by person and day. One-off requests and soft recurring rules share this map,
  // so the generator, the checks and the grid treat them alike.
  const req = {};
  const reqList = [];
  const addReq = (r) => {
    if (!leave[r.staffId]) return; // person was removed
    const k = `${r.staffId}|${r.date}`;
    (req[k] = req[k] || []).push(r);
    reqList.push(r);
  };
  for (const r of st.requests) addReq(r);

  // Fixed recurring rules by person and day. These are never broken by the generator.
  const fixed = {};
  for (const r of st.recurring || []) {
    if (!leave[r.staffId]) continue;
    const strict = r.strict && r.kind !== 'want';
    for (const d of days) {
      if (!ruleOnDow(r, d.dow)) continue;
      if (strict) {
        const k = `${r.staffId}|${d.date}`;
        (fixed[k] = fixed[k] || []).push(r);
      } else {
        addReq({ id: `${r.id}|${d.date}`, staffId: r.staffId, date: d.date, kind: r.kind, shiftId: r.shiftId, rule: r });
      }
    }
  }
  // Fixed rules a shift would break for this person on this day.
  const broken = (staffId, date, shiftId) =>
    (fixed[`${staffId}|${date}`] || []).filter((r) => r.kind === 'off' || (r.kind === 'avoid' && r.shiftId === shiftId));
  const allowed = (staffId, date, shiftId) => broken(staffId, date, shiftId).length === 0;
  const blockedDay = (staffId, date) => (fixed[`${staffId}|${date}`] || []).some((r) => r.kind === 'off');

  const avgPaid = shifts.length ? shifts.reduce((a, b) => a + b.paid, 0) / shifts.length : 8;

  return {
    st, days, N, shifts, leave, need, posList, staffPos, posNeed, cls, target, sumT, totU, totD, expU, expD,
    req, reqList, fixed, broken, allowed, blockedDay, needH, needSlots, avgPaid,
  };
}

// Small seeded random generator so each attempt is repeatable.
export function rng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function reqMet(r, sid) {
  if (r.kind === 'off') return !sid;
  if (r.kind === 'want') return r.shiftId ? sid === r.shiftId : !!sid;
  if (r.kind === 'avoid') return sid !== r.shiftId;
  return true;
}

function runOnce(C, jit, rand) {
  const set = C.st.settings;
  const minRest = +set.minRest || 0;
  const maxC = +set.maxConsec || 99;
  const P = C.st.staff.map((s) => ({
    id: s.id, t: C.target[s.id], h: 0, u: 0, d: 0, lastEnd: -1e9, w: new Array(C.N).fill(false),
  }));
  const cells = {};
  let unfilled = 0;
  let posGaps = 0;
  const rank = { u: 0, n: 1, d: 2 };

  // Give one place on a shift to the cheapest free person. With pos, only people of that position.
  const fill = (day, sh, c, pos) => {
    const i = day.idx;
    const frac = (i + 1) / C.N;
    let best = null;
    let bc = Infinity;
    const start = i * 24 + sh.startH;
    for (const p of P) {
      if (pos && C.staffPos[p.id] !== pos) continue;
      if (p.w[i] || C.leave[p.id].has(day.date)) continue;
      if (!C.allowed(p.id, day.date, sh.id)) continue;
      if (start - p.lastEnd < minRest) continue;
      let cons = 0;
      for (let j = i - 1; j >= 0 && p.w[j]; j -= 1) cons += 1;
      if (cons >= maxC) continue;
      const unit = Math.max(sh.paid, 1);
      let cost = 10 * ((p.h + sh.paid - p.t * frac) / unit);
      const over = p.h + sh.paid - (p.t + sh.paid * 0.5);
      if (over > 0) cost += (30 * over) / unit + 20;
      if (c === 'u') cost += 8 * (p.u + 1 - C.expU[p.id] * frac);
      if (c === 'd') cost += 8 * (p.d + 1 - C.expD[p.id] * frac);
      const rs = C.req[`${p.id}|${day.date}`];
      if (rs) {
        for (const r of rs) {
          if (r.kind === 'off') cost += 45;
          else if (r.kind === 'want') cost += (!r.shiftId || r.shiftId === sh.id) ? -45 : 12;
          else if (r.kind === 'avoid' && r.shiftId === sh.id) cost += 40;
        }
      }
      cost += rand() * jit;
      if (cost < bc) { bc = cost; best = p; }
    }
    if (!best) return false;
    cells[`${best.id}|${day.date}`] = sh.id;
    best.w[i] = true;
    best.h += sh.paid;
    best.lastEnd = start + sh.len;
    if (c === 'u') best.u += 1;
    else if (c === 'd') best.d += 1;
    return true;
  };

  for (const day of C.days) {
    const order = C.shifts
      .map((sh) => ({ sh, c: C.cls(day, sh), r: rand() }))
      .sort((a, b) => rank[a.c] - rank[b.c] || a.r - b.r);
    // Position places first, on every shift of the day, so those people are not used up elsewhere.
    for (const o of order) {
      o.open = C.need(day, o.sh);
      for (const p of C.posNeed(day, o.sh)) {
        for (let k = 0; k < p.n; k += 1) {
          if (fill(day, o.sh, o.c, p.key)) o.open -= 1;
          else posGaps += 1; // the place stays open and goes to anyone below
        }
      }
    }
    for (const o of order) {
      for (let k = 0; k < o.open; k += 1) if (!fill(day, o.sh, o.c, '')) unfilled += 1;
    }
  }

  let cost = unfilled * 1000 + posGaps * 400;
  for (const p of P) {
    const hd = (p.h - p.t) / C.avgPaid;
    cost += 3 * hd * hd + 4 * (p.u - C.expU[p.id]) ** 2 + 3 * (p.d - C.expD[p.id]) ** 2;
  }
  for (const r of C.reqList) {
    if (!reqMet(r, cells[`${r.staffId}|${r.date}`])) cost += 6;
  }
  return { cells, cost, unfilled, posGaps };
}

// Best of many attempts within about a second. Returns a plan object for S.plan.
export function generate(S) {
  const C = ctx(S);
  const t0 = performance.now();
  let best = null;
  let runs = 0;
  while (runs < 600 && (runs < 40 || performance.now() - t0 < 900)) {
    const r = runOnce(C, runs === 0 ? 0 : 12, rng(runs * 7919 + 13));
    if (!best || r.cost < best.cost) best = r;
    runs += 1;
  }
  return { month: S.month, cells: best.cells, generatedAt: new Date().toISOString(), runs, edited: false };
}

// Rule conflicts, per-person totals and daily cover for a set of cells.
export function evaluate(C, cells) {
  const set = C.st.settings;
  const issues = {}; const per = {}; const cover = {};
  const shById = Object.fromEntries(C.shifts.map((s) => [s.id, s]));

  for (const s of C.st.staff) {
    const p = { h: 0, u: 0, d: 0, n: 0, reqT: 0, reqM: 0 };
    per[s.id] = p;
    let lastEnd = -1e9;
    let cons = 0;
    for (const day of C.days) {
      const key = `${s.id}|${day.date}`;
      const sid = cells[key];
      const sh = shById[sid];
      const msgs = [];
      if (sh) {
        const start = day.idx * 24 + sh.startH;
        if (C.leave[s.id].has(day.date)) msgs.push('On leave this day');
        for (const r of C.broken(s.id, day.date, sid)) msgs.push(`Breaks a fixed rule: ${ruleText(C.st, r)}`);
        if (start - lastEnd < set.minRest) msgs.push(`Only ${fmtH(start - lastEnd)} h rest after previous shift (minimum ${set.minRest} h)`);
        cons += 1;
        if (cons > set.maxConsec) msgs.push(`${cons} days in a row (maximum ${set.maxConsec})`);
        lastEnd = start + sh.len;
        p.h += sh.paid;
        p.n += 1;
        const c = C.cls(day, sh);
        if (c === 'u') p.u += 1;
        else if (c === 'd') p.d += 1;
      } else {
        cons = 0;
      }
      const rs = C.req[key];
      if (rs) {
        for (const r of rs) {
          p.reqT += 1;
          if (reqMet(r, sid)) p.reqM += 1;
        }
      }
      if (msgs.length) issues[key] = msgs;
    }
  }

  for (const day of C.days) {
    let need = 0; let have = 0;
    const by = {};
    for (const sh of C.shifts) {
      const n = C.need(day, sh);
      need += n;
      by[sh.id] = { need: n, have: 0, pos: C.posNeed(day, sh).map((p) => ({ key: p.key, name: p.name, need: p.n, have: 0 })) };
    }
    for (const s of C.st.staff) {
      const sid = cells[`${s.id}|${day.date}`];
      if (!sid || !by[sid]) continue;
      by[sid].have += 1;
      have += 1;
      const p = by[sid].pos.find((x) => x.key === C.staffPos[s.id]);
      if (p) p.have += 1;
    }
    // short = empty places; posShort = places a required position does not hold.
    let short = 0; let posShort = 0;
    for (const k in by) {
      short += Math.max(0, by[k].need - by[k].have);
      for (const p of by[k].pos) posShort += Math.max(0, p.need - p.have);
    }
    cover[day.date] = { need, have, short, posShort, by };
  }
  return { issues, per, cover };
}
