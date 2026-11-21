import { applyChartTheme, chartDocument } from './document.js';
import { layoutChart } from './layout.js';
import { movePoint, navigable, pointAt } from './point-navigation.js';
import { ensureChartStyles } from './tokens.js';
import { chartLabel, summarizeChart } from './summary.js';

function smallPoint(spec) {
  return {
    series: 0,
    index: 0,
    row: 0,
    x: 0,
    y: 0,
    text: summarizeChart(spec),
    datum: spec,
  };
}

function bind(container, handlers) {
  for (const [type, handler] of Object.entries(handlers)) {
    container.addEventListener(type, handler);
  }
  return () => {
    for (const [type, handler] of Object.entries(handlers)) {
      container.removeEventListener(type, handler);
    }
  };
}

function findEntry(entries, target) {
  return (
    target?.nodeType && entries.find(({ element }) => element?.contains(target))
  );
}

function findMarks(series, mark) {
  return series.flatMap(({ points }, s) =>
    points.map((point, index) => ({
      series: s,
      index,
      point,
      element: mark(point),
    }))
  );
}

function pointerHandlers(find, show, hide) {
  return {
    pointermove(event) {
      if (event.pointerType !== 'touch') {
        const entry = find(event.target);
        if (entry) {
          show(entry, event);
        } else {
          hide();
        }
      }
    },
    pointerleave(event) {
      if (event.pointerType !== 'touch') {
        hide();
      }
    },
    pointerup(event) {
      const entry = find(event.target);
      if (entry && event.pointerType === 'touch') {
        show(entry, event);
      }
    },
  };
}

/** Attach keyboard, pointer, and shared tooltip behavior to a host drawing. */
export function attachChartInteraction(container, spec, options = {}) {
  const layout =
    options.layout ?? (spec.kind === 'chart' ? layoutChart(spec) : null);
  const series = layout ? navigable(layout) : [{ points: [smallPoint(spec)] }];
  const mark =
    options.mark ??
    ((point) => container.querySelector(`[data-chart-row="${point.row}"]`));
  const document = container.ownerDocument;
  ensureChartStyles(document);
  const previousLabel = container.getAttribute('aria-label');
  const previousRole = container.getAttribute('role');
  if (
    !container.hasAttribute('aria-label') &&
    !container.hasAttribute('aria-labelledby')
  ) {
    container.setAttribute('aria-label', layout?.label ?? chartLabel(spec));
    if (!previousRole) {
      container.setAttribute('role', 'group');
    }
  }
  applyChartTheme(container);
  let active = null;
  let entries = [];
  const tabs = new Map();

  function setTab(element, tabIndex) {
    if (!tabs.has(element)) {
      tabs.set(element, element.getAttribute('tabindex'));
    }
    element.tabIndex = tabIndex;
  }

  function restoreTabs() {
    for (const [element, value] of tabs) {
      if (value === null) {
        element.removeAttribute('tabindex');
      } else {
        element.setAttribute('tabindex', value);
      }
    }
    tabs.clear();
  }

  function refresh() {
    restoreTabs();
    const point = active?.point;
    entries = findMarks(series, mark);
    const elements = [
      ...new Set(entries.map(({ element }) => element).filter(Boolean)),
    ];
    active = entries.find((entry) => entry.point === point) ?? null;
    const tab = active?.element ?? elements[0];
    elements.forEach((element) => setTab(element, element === tab ? 0 : -1));
    if (!elements.length) {
      setTab(container, 0);
    }
    applyChartTheme(container);
  }

  function hide() {
    chartDocument(document).hide(container);
  }

  function show(entry, event) {
    const source = entry.element ?? container;
    chartDocument(document).show(container, {
      source,
      point: entry.point,
      spec,
      event,
      label: options.label,
    });
  }

  function focusPoint(seriesIndex, index) {
    const at = pointAt(series, { series: seriesIndex, index });
    const entry = entries.find(({ point }) => point === at?.point);
    if (!entry) {
      return;
    }
    const tab = entry.element ?? container;
    for (const [element] of tabs) {
      setTab(element, -1);
    }
    setTab(tab, 0);
    active = entry;
    if (document.activeElement === tab) {
      show(entry);
    } else {
      tab.focus();
    }
    return entry.point;
  }

  const unbind = bind(container, {
    focusin(event) {
      const entry =
        findEntry(entries, event.target) ??
        (event.target === container ? (active ?? entries[0]) : null);
      if (entry) {
        if (active && active.element !== entry.element) {
          setTab(active.element ?? container, -1);
        }
        setTab(entry.element ?? container, 0);
        active = entry;
        show(entry);
      }
    },
    focusout(event) {
      if (
        !findEntry(entries, event.relatedTarget) &&
        event.relatedTarget !== container
      ) {
        hide();
      }
    },
    keydown(event) {
      if (!findEntry(entries, event.target) && event.target !== container) {
        return;
      }
      const next = movePoint(
        series,
        active,
        event.key,
        spec.mark?.type === 'calendar'
      );
      if (next) {
        event.preventDefault();
        focusPoint(next.series, next.index);
      }
    },
    ...pointerHandlers((target) => findEntry(entries, target), show, hide),
  });
  refresh();
  return {
    layout,
    get activePoint() {
      return active?.point ?? null;
    },
    focusPoint,
    refresh,
    destroy() {
      hide();
      unbind();
      restoreTabs();
      if (previousLabel === null) {
        container.removeAttribute('aria-label');
      }
      if (previousRole === null) {
        container.removeAttribute('role');
      }
      container.removeAttribute('data-ui-chart-theme');
    },
  };
}
