# Staffy

Plan a fair monthly duty roster for a small team. Add staff and their contracted hours, define shift types,
say how many people each shift needs per weekday, record leave and wishes, then generate a rota that shares
good and bad shifts out fairly and respects rest time. Web app for desktop and phone, no build step.

Built from the Claude artifact "Shift Rota Planner".

## Run it

No build step. Serve the folder so ES modules load:

```
npx serve .
```

or

```
python3 -m http.server
```

Then open http://localhost:3000 (or :8000). On a desktop browser you get the wide duty-board layout
(tab strip under the header, up to 1440px). Narrow the window below 768px, or use the device toolbar at
390 × 844, for the phone layout with the bottom tab bar.

## What it does

- **Rota** – generates a month plan (best of many attempts within about a second), shows cover per day,
  rule conflicts in red, and a fairness table. Tap a cell to change a shift by hand. Export CSV or copy
  the table for a spreadsheet.
- **Staff** – names and hours per month. Targets shrink for leave days if that rule is on.
- **Shifts** – shift types (times, break, desirable / neutral / undesirable, colour), default staff needed
  per weekday, per-day overrides for this month, and rules (minimum rest, max days in a row).
- **Leave** – leave periods (never scheduled), one-off requests (day off, wants to work, avoid a shift) that the
  planner tries to meet, and recurring requests per person ("never on Mondays", "no night shifts", "wants Early on
  Fridays"). A recurring rule can be **fixed** (never broken) or a wish.

Everything is saved in `localStorage` on this device only. On first open the app shows example data;
"Start with a blank plan" clears it.

## Grid

- Rules: `design-grid-rules.md`
- Reference image: `docs/grid-reference.svg` (or `.png`)
- Overlay: press **G** in the browser, or add `?grid` to the URL

## Structure

```
CLAUDE.md               rules for Claude
design-grid-rules.md    layout and spacing rules
index.html              app shell (Header with month picker, Content, Tab bar)
css/tokens.css          all design values (light and dark)
css/styles.css          reset, shell, grid, components, rota grid, popover, overlay
js/app.js               entry: routing, rendering, events
js/state.js             state, example data, saving to localStorage
js/schedule.js          month context, generator, plan evaluation
js/render-plan.js       Rota screen
js/render-staff.js      Staff screen
js/render-shifts.js     Shifts screen
js/render-leave.js      Leave screen
js/render-shared.js     shared markup (banner, empty screen, remove button)
js/popover.js           shift picker over a rota cell
js/export.js            CSV download and clipboard copy
js/util.js              dates, formatting, escaping, labels
js/grid-overlay.js      G-key grid overlay
assets/images/          icon
docs/                   grid reference image
task/todo.md            plan, checklist and review
```
