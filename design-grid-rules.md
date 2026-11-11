# Mobile Design Grid Rules

These rules define the layout system for this project. Follow them for every screen, component, and line of UI code. When a request is ambiguous, resolve it using these rules rather than guessing.

---

## 1. Frame

- **Base frame:** 390 × 844 pt (iPhone standard). Android equivalent: 360 × 800 dp.
- **Top safe area:** 47 pt (status bar / notch). Never place content here.
- **Bottom safe area:** 34 pt (home indicator). Never place interactive content here.
- Design for the base frame first. Layouts must stretch horizontally, not scale.

## 2. Columns

- **4 columns**, equal width (fluid).
- **Outer margins:** 16 pt left and right.
- **Gutters:** 16 pt between columns.
- On a 390 pt screen, each column is 77.5 pt wide ((390 − 32 − 48) ÷ 4).
- Columns are numbered **1–4, left to right**.
- Elements must start and end on column edges. Valid spans:
  - `1–4` full width
  - `1–2`, `3–4` halves
  - `1`, `2`, `3`, `4` quarters
  - `1–3`, `2–4` three-quarters
- Full-bleed elements (edge to edge, ignoring margins) must be explicitly called **"full-bleed"**. Typical uses: hero images, maps, dividers.

## 3. Spacing (8-point system)

- All sizes, padding, margins, and gaps use the scale below. No other values.

| Token | Value | Typical use |
|-------|-------|-------------|
| `space-0.5` | 4 pt | Icon-to-label, tight inline gaps |
| `space-1` | 8 pt | Gaps inside a component |
| `space-2` | 16 pt | Card padding, gutters, list item gaps |
| `space-3` | 24 pt | Gap between related sections |
| `space-4` | 32 pt | Gap between unrelated sections |
| `space-6` | 48 pt | Large section breaks |
| `space-8` | 64 pt | Screen-level breathing room |

- 4 pt is only for fine detail. Default to multiples of 8.

## 4. Zones

Every screen is divided vertically into named zones. Reference positions by zone, not by row number.

| Zone | Height | Notes |
|------|--------|-------|
| **Status** | 47 pt | System only. Safe area. |
| **Header** | 56 pt | Title, back button, actions. Fixed. |
| **Content** | Remaining | Scrolls. Holds all screen content. |
| **Tab bar** | 56 pt + 34 pt safe area | Fixed. Max 5 items. Optional per screen. |

- Optional zones: **Search bar** (56 pt, directly below Header), **Bottom action** (fixed primary button above the Tab bar or safe area, 48 pt button + 16 pt padding).
- If a screen has no Tab bar, say so explicitly.

## 5. Sizes

### Touch targets
- Minimum tap area: **48 × 48 pt** (44 pt absolute minimum on iOS).

### Components
| Element | Height |
|---------|--------|
| Primary / secondary button | 48 pt |
| Small button | 32 pt |
| Text input | 48 pt |
| List row (single line) | 56 pt |
| List row (two lines) | 72 pt |
| Icon | 24 pt (16 pt small) |
| Avatar | 40 pt (32 small, 64 large) |

### Corner radius
- `radius-sm` 8 pt: inputs, small buttons, chips
- `radius-md` 12 pt: cards
- `radius-lg` 16 pt: sheets, modals
- `radius-full`: pills, avatars

## 6. Typography

Use only these sizes. Line heights snap to the 4 pt grid.

| Token | Size / line height | Use |
|-------|-------------------|-----|
| `text-xs` | 12 / 16 | Captions, labels |
| `text-sm` | 14 / 20 | Secondary text |
| `text-base` | 16 / 24 | Body (default) |
| `text-lg` | 20 / 28 | Card titles, subheads |
| `text-xl` | 28 / 36 | Screen titles |

- Minimum body text: 16 pt. Never below 12 pt.

## 7. How to reference positions

Use this format: **Zone → Columns → Spacing → Size**

**Examples:**
- "Content zone, card spanning 1–4, `space-3` below Header, `space-2` internal padding."
- "Inside the card: image in column 1, title and price stacked in columns 2–4, `space-1` between them."
- "Product tiles, span 2 each (two per row), `space-2` row gap."
- "Bottom action: primary button spanning 1–4, 48 pt high."

When describing a change, name what moves and where:
- "Move the filter button from Header right to Content, columns 3–4, `space-2` below the search bar."

## 8. Code mapping

### CSS
```css
.screen {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  column-gap: 16px;
  padding-inline: 16px;
}
.span-full    { grid-column: 1 / 5; }
.span-half    { grid-column: span 2; }
.span-quarter { grid-column: span 1; }
.full-bleed   { margin-inline: -16px; grid-column: 1 / 5; }
```

### Tailwind
- Grid: `grid grid-cols-4 gap-x-4 px-4`
- Spans: `col-span-4`, `col-span-2`, `col-span-1`, `col-start-2`
- Spacing tokens: 4 → `1`, 8 → `2`, 16 → `4`, 24 → `6`, 32 → `8`, 48 → `12`, 64 → `16`

### SwiftUI / Jetpack Compose
- Define the spacing scale and sizes as constants (e.g. `Spacing.s2 = 16`) and use only those.
- Horizontal screen padding: 16. Column widths derived from `(width - 32 - 48) / 4`.

## 9. Rules for the AI

1. Never use a spacing, size, or font value that is not in this file. If one seems needed, ask first.
2. Every element must declare its zone and column span.
3. Keep all interactive elements out of the Status and bottom safe areas.
4. Prefer fewer, larger elements over many small ones. Respect 48 pt tap targets.
5. When creating a new screen, first list its zones and the column span of each block, then build.
6. If a request conflicts with these rules, point out the conflict and suggest the closest valid option.
7. Keep components consistent: the same element uses the same size and spacing everywhere.
