import { autoUpdate, computePosition, flip, offset, shift } from './vendor/floating-ui-dom.js';

let tooltip = null;
let cleanup = null;
let activeTrigger = null;

function ensureTooltip() {
  if (tooltip) return tooltip;
  tooltip = document.createElement('div');
  tooltip.id = 'delivera-contextual-help';
  tooltip.className = 'delivera-contextual-help';
  tooltip.setAttribute('role', 'tooltip');
  tooltip.hidden = true;
  document.body.appendChild(tooltip);
  return tooltip;
}

async function place(trigger) {
  const result = await computePosition(trigger, tooltip, { placement: 'top-start', middleware: [offset(8), flip(), shift({ padding: 8 })] });
  Object.assign(tooltip.style, { left: `${result.x}px`, top: `${result.y}px` });
}

function show(trigger) {
  const copy = String(trigger?.dataset?.contextHelp || '').trim();
  if (!copy) return;
  hide();
  activeTrigger = trigger;
  const el = ensureTooltip();
  el.textContent = copy;
  el.hidden = false;
  trigger.setAttribute('aria-describedby', el.id);
  cleanup = autoUpdate(trigger, el, () => place(trigger));
}

function hide() {
  cleanup?.(); cleanup = null;
  if (activeTrigger) activeTrigger.removeAttribute('aria-describedby');
  activeTrigger = null;
  if (tooltip) tooltip.hidden = true;
}

export function initContextualHelp() {
  ensureTooltip();
  document.addEventListener('pointerover', (event) => {
    if (event.pointerType === 'touch') return;
    const trigger = event.target.closest?.('[data-context-help]');
    if (trigger) show(trigger);
  });
  document.addEventListener('pointerout', (event) => {
    if (activeTrigger && !activeTrigger.contains(event.relatedTarget)) hide();
  });
  document.addEventListener('focusin', (event) => { const trigger = event.target.closest?.('[data-context-help]'); if (trigger) show(trigger); });
  document.addEventListener('focusout', (event) => { if (activeTrigger && !activeTrigger.contains(event.relatedTarget)) hide(); });
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest?.('[data-context-help]');
    if (!trigger || event.pointerType !== 'touch') return;
    if (activeTrigger === trigger) hide(); else show(trigger);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') hide(); });
}
