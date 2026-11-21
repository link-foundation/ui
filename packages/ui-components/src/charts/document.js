import { positionFloating, virtualAnchor } from '../overlays/position.js';
import { renderTooltipContent } from './tooltip.js';

const documents = new WeakMap();
const presentationObservers = new WeakMap();

export function pageTheme(element) {
  const set = element.closest('[data-theme]')?.getAttribute('data-theme');
  if (set === 'dark' || set === 'light') {
    return set;
  }
  const win = element.ownerDocument.defaultView;
  return win.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

function updateDescription(element, id, enabled) {
  const ids = new Set(
    (element.getAttribute('aria-describedby') ?? '')
      .split(/\s+/u)
      .filter(Boolean)
  );
  if (enabled) {
    ids.add(id);
  } else {
    ids.delete(id);
  }
  if (ids.size) {
    element.setAttribute('aria-describedby', [...ids].join(' '));
  } else {
    element.removeAttribute('aria-describedby');
  }
}

function defaultPosition(tooltip, anchor) {
  return positionFloating(anchor, tooltip, {
    placement: 'right-start',
    offset: 10,
    crossAxis: true,
  });
}

function createOverlay(document, options) {
  const tooltip = document.createElement('div');
  tooltip.id = 'ui-chart-tooltip';
  let suffix = 1;
  while (document.getElementById(tooltip.id)) {
    tooltip.id = `ui-chart-tooltip-${suffix++}`;
  }
  tooltip.className = 'ui-chart-tooltip ui-chart-tooltip-top';
  if (options.className) {
    tooltip.className += ` ${options.className}`;
  }
  tooltip.setAttribute('role', 'tooltip');
  tooltip.setAttribute('popover', 'manual');
  tooltip.hidden = true;
  const live = document.createElement('div');
  live.className = 'ui-chart-live ui-visually-hidden';
  live.setAttribute('role', 'status');
  live.setAttribute('aria-atomic', 'true');
  (options.overlayRoot ?? document.body ?? document.documentElement).append(
    tooltip,
    live
  );
  return { tooltip, live };
}

function inputMethod(event) {
  return event?.pointerType === 'touch' ? 'tap' : event ? 'pointer' : 'focus';
}

function isSameTap(current, owner, point) {
  return (
    current?.owner === owner &&
    current.point === point &&
    current.trigger === 'tap'
  );
}

function createDocumentState(document) {
  let overlay;
  let current;
  let stop;
  const state = {
    options: {},
    configured: false,
    show,
    hide,
    refresh,
    dispose,
  };

  function dispose() {
    hide();
    overlay?.tooltip.remove();
    overlay?.live.remove();
    overlay = undefined;
  }

  function theme(source) {
    return state.options.theme?.(source) ?? pageTheme(source);
  }

  function hide(owner) {
    if (!current || (owner && current.owner !== owner)) {
      return;
    }
    stop?.();
    stop = undefined;
    const { tooltip, live } = overlay;
    updateDescription(current.source, tooltip.id, false);
    if (tooltip.matches(':popover-open')) {
      tooltip.hidePopover();
    }
    tooltip.hidden = true;
    live.textContent = '';
    current = undefined;
    document.removeEventListener('keydown', escape);
    document.removeEventListener('pointerdown', dismissOutside);
  }

  function escape(event) {
    if (event.key === 'Escape') {
      hide();
    }
  }

  function dismissOutside(event) {
    if (
      !current.owner.contains(event.target) &&
      !overlay.tooltip.contains(event.target)
    ) {
      hide();
    }
  }

  function updateContent(details, tooltip, live) {
    if (
      current?.point !== details.point ||
      current.source !== details.source ||
      current.trigger !== details.trigger ||
      current.text !== details.text
    ) {
      const rendered = state.options.renderTooltip?.(details);
      if (rendered !== undefined && rendered !== null) {
        tooltip.replaceChildren(rendered);
      } else {
        renderTooltipContent(
          tooltip,
          details.spec.tooltip?.content?.(details.point.datum),
          details.text
        );
      }
      live.textContent = details.text;
    }
  }

  function tooltipAnchor(info, trigger) {
    if (trigger === 'pointer') {
      return virtualAnchor(info.event.clientX, info.event.clientY, info.source);
    }
    return info.anchor ?? info.source;
  }

  function show(owner, info) {
    const { source, point, spec, event, label } = info;
    overlay ??= createOverlay(document, state.options);
    const { tooltip, live } = overlay;
    const trigger = inputMethod(event);
    if (isSameTap(current, owner, point)) {
      if (trigger === 'focus') {
        return;
      }
      if (trigger === 'tap') {
        hide();
        return;
      }
    }
    const details = {
      point,
      spec,
      source,
      trigger,
      text: (label ?? state.options.label)?.(point, spec) ?? point.text,
      theme: theme(owner),
    };
    if (current?.source !== source && current) {
      updateDescription(current.source, tooltip.id, false);
    }
    updateContent(details, tooltip, live);
    current = { ...details, owner, info };
    tooltip.dataset.theme = details.theme;
    tooltip.hidden = false;
    if (!tooltip.matches(':popover-open')) {
      tooltip.showPopover?.();
    }
    updateDescription(source, tooltip.id, true);
    const anchor = tooltipAnchor(info, trigger);
    stop?.();
    stop = (state.options.positionTooltip ?? defaultPosition)(
      tooltip,
      anchor,
      details
    );
    document.addEventListener('keydown', escape);
    document.addEventListener('pointerdown', dismissOutside);
  }

  function refresh() {
    for (const node of document.querySelectorAll('[data-ui-chart-theme]')) {
      applyChartTheme(node);
      presentationObservers.get(node)?.();
    }
    if (current) {
      const { owner, info } = current;
      hide();
      show(owner, info);
    }
  }

  return state;
}

/** One lazily mounted tooltip and live region for each document. */
export function chartDocument(document) {
  if (!documents.has(document)) {
    documents.set(document, createDocumentState(document));
  }
  return documents.get(document);
}

/** Configure shared presentation and activate it for registered charts. */
export function configureChartDocument(document, options = {}) {
  const previous = documents.get(document);
  // A new configuration replaces the old overlay on its next use.
  previous?.dispose?.();
  const state = createDocumentState(document);
  state.options = options;
  state.configured = true;
  documents.set(document, state);
  state.refresh();
  return {
    refresh: state.refresh,
    destroy() {
      if (documents.get(document) === state) {
        state.dispose();
        documents.delete(document);
        state.refresh();
      }
    },
  };
}

export function applyChartTheme(element) {
  const mode = chartDocument(element.ownerDocument).options.theme?.(element);
  element.setAttribute('data-ui-chart-theme', mode ?? '');
}

export function observeChartPresentation(element, callback) {
  if (callback) {
    presentationObservers.set(element, callback);
  } else {
    presentationObservers.delete(element);
  }
}

export function chartPresentation(source) {
  const { options, configured } = chartDocument(source.ownerDocument);
  return {
    theme: options.theme?.(source) ?? pageTheme(source),
    tooltip: !configured,
  };
}
