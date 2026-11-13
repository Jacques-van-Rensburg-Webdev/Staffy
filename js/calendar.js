// Calendar view behaviour: open a day, move a shift by tapping, or by dragging with a mouse.
import { moveShift } from './moves.js';
import { storeView } from './state.js';

export function initCalendar({ ui, getState, render, update }) {
  let dragKey = null;
  let overEl = null;

  const focusDay = (date) => {
    const el = document.getElementById(`cd-${date}`);
    if (el) el.focus({ preventScroll: true });
  };
  const clearOver = () => {
    if (overEl) overEl.classList.remove('is-over');
    overEl = null;
  };
  // Move, then show the day the shift landed on.
  const move = (key, to) => {
    const [staffId, from] = key.split('|');
    const done = moveShift(getState(), staffId, from, to);
    ui.move = null;
    if (done) { ui.day = to; update(); } else render();
    focusDay(to);
  };

  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-cal]');
    if (act) {
      const what = act.dataset.cal;
      if (what === 'view') {
        ui.view = act.dataset.id === 'calendar' ? 'calendar' : 'grid';
        ui.move = null;
        storeView(ui.view);
        render();
        const btn = document.getElementById(`view-${ui.view}`);
        if (btn) btn.focus({ preventScroll: true });
      } else if (what === 'move') {
        const [staffId, date] = act.dataset.key.split('|');
        ui.move = { staffId, date };
        render();
        const cal = document.getElementById('cal-moving');
        if (cal) cal.scrollIntoView({ block: 'nearest' });
        focusDay(date);
      } else if (what === 'cancel') {
        ui.move = null;
        render();
      } else if (what === 'close') {
        const date = ui.day;
        ui.day = null;
        render();
        focusDay(date);
      }
      return;
    }
    const day = e.target.closest('[data-day]');
    if (!day) return;
    const date = day.dataset.day;
    if (ui.move) { move(`${ui.move.staffId}|${ui.move.date}`, date); return; }
    ui.day = ui.day === date ? null : date;
    render();
    focusDay(date);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && ui.move) {
      ui.move = null;
      render();
    }
  });

  /* Drag a tag to another day (mouse). Touch uses Move in the day card. */
  document.addEventListener('dragstart', (e) => {
    const tag = e.target.closest && e.target.closest('[data-drag]');
    if (!tag) return;
    dragKey = tag.dataset.drag;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragKey);
  });
  document.addEventListener('dragover', (e) => {
    if (!dragKey) return;
    const day = e.target.closest('[data-day]');
    if (day !== overEl) {
      clearOver();
      overEl = day;
      if (day) day.classList.add('is-over');
    }
    if (day) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
    }
  });
  document.addEventListener('drop', (e) => {
    if (!dragKey) return;
    const day = e.target.closest('[data-day]');
    const key = dragKey;
    dragKey = null;
    clearOver();
    if (!day) return;
    e.preventDefault();
    move(key, day.dataset.day);
  });
  document.addEventListener('dragend', () => {
    dragKey = null;
    clearOver();
  });
}
