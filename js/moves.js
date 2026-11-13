// Manual moves in the calendar view: take one person's shift to another day.

// Moves the shift a person works on `from` to `to`, keeping the shift type. If they already
// work on `to`, the two days are exchanged. Nothing is blocked here: rule conflicts show up
// in the checks (schedule.js evaluate). Returns true if the plan changed.
export function moveShift(S, staffId, from, to) {
  if (!S.plan || S.plan.month !== S.month || from === to) return false;
  if (!from.startsWith(S.month) || !to.startsWith(S.month)) return false;
  const { cells } = S.plan;
  const a = `${staffId}|${from}`;
  const b = `${staffId}|${to}`;
  const moving = cells[a];
  if (!moving) return false;
  const there = cells[b];
  cells[b] = moving;
  if (there) cells[a] = there;
  else delete cells[a];
  S.plan.edited = true;
  return true;
}
