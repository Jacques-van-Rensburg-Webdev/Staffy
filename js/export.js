// Export the rota as CSV (file download) or tab-separated text (clipboard).
import { ctx, evaluate } from './schedule.js';
import { DOW, fmtH } from './util.js';

const RESET_DELAY = 2000;

export function csvText(S, sep) {
  const C = ctx(S);
  const cells = S.plan.cells;
  const shById = Object.fromEntries(C.shifts.map((s) => [s.id, s]));
  const E = evaluate(C, cells);
  const q = (v) => {
    const s = String(v);
    return sep === ',' && /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = [['Staff', 'Position', ...C.days.map((d) => `${DOW[d.dow].slice(0, 2)} ${d.day}`), 'Hours', 'Target']];
  for (const s of S.staff) {
    rows.push([
      s.name,
      String(s.position || '').trim(),
      ...C.days.map((d) => {
        const sh = shById[cells[`${s.id}|${d.date}`]];
        if (sh) return sh.code;
        return C.leave[s.id].has(d.date) ? 'Leave' : '';
      }),
      fmtH(E.per[s.id].h),
      fmtH(C.target[s.id]),
    ]);
  }
  rows.push([]);
  rows.push(['Key', ...C.shifts.map((sh) => `${sh.code} = ${sh.name} ${sh.start}-${sh.end}`)]);
  return rows.map((r) => r.map(q).join(sep)).join('\n');
}

function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = old; }, RESET_DELAY);
}

export function exportCSV(S, btn) {
  try {
    const blob = new Blob([csvText(S, ',')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `rota-${S.month}.csv`;
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), RESET_DELAY);
    flash(btn, 'Exported');
  } catch {
    flash(btn, 'Export failed');
  }
}

export async function copyTable(S, btn) {
  try {
    await navigator.clipboard.writeText(csvText(S, '\t'));
    flash(btn, 'Copied, paste into a spreadsheet');
  } catch {
    flash(btn, 'Copy not allowed here');
  }
}
