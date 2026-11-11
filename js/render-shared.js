// Bits of markup shared by more than one screen.
import { esc } from './util.js';

export const exampleBanner = `<div class="span-4 banner"><span><b>Example data.</b> This team, its shifts and leave are made up to show how the planner works. Edit them or start fresh.</span><button class="button button-sm" type="button" data-act="clear-example">Start with a blank plan</button></div>`;

// Content, columns 1–4: a card with a title, a hint and one link button.
export function emptyScreen(title, hint, href, label) {
  return `<section class="span-4 card stack-1">
    <h2 class="heading">${esc(title)}</h2>
    <p class="hint">${esc(hint)}</p>
    <div class="button-row"><a class="button button-primary" href="${href}">${esc(label)}</a></div>
  </section>`;
}

export function removeButton(act, id, name) {
  return `<button class="icon-button icon-button-remove" type="button" data-act="${act}" data-id="${id}" aria-label="Remove ${esc(name)}" title="Remove">×</button>`;
}
