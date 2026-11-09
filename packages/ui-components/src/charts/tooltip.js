/** Rich tooltip content uses DOM text nodes only, never consumer HTML. */
import { positionFloating, virtualAnchor } from '../overlays/position.js';

export function tooltipContent(tooltip, point, spec) {
  const content = spec.tooltip?.content?.(point.datum);
  tooltip.replaceChildren();
  if (!content || typeof content !== 'object') {
    tooltip.textContent = point.text;
    return;
  }
  const document = tooltip.ownerDocument;
  for (const [tag, value] of [
    ['strong', content.title],
    ['div', content.value],
  ]) {
    if (value === null || value === undefined) {
      continue;
    }
    const element = document.createElement(tag);
    element.textContent = String(value);
    tooltip.append(element);
  }
  if (content.rows?.length) {
    const list = document.createElement('dl');
    for (const [label, value] of content.rows) {
      const term = document.createElement('dt'),
        detail = document.createElement('dd');
      term.textContent = String(label);
      detail.textContent = String(value);
      list.append(term, detail);
    }
    tooltip.append(list);
  }
}

export function showTopTooltip(tooltip, canvas, x, y, left) {
  tooltip.setAttribute('popover', 'manual');
  tooltip.classList.add('ui-chart-tooltip-top');
  tooltip.hidden = false;
  if (!tooltip.matches(':popover-open')) {
    tooltip.showPopover?.();
  }
  return positionFloating(virtualAnchor(x, y, canvas), tooltip, {
    placement: left ? 'left-start' : 'right-start',
    offset: 10,
  });
}
