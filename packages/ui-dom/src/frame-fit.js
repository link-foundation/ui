function classifyBlocks(current, root, levels, boundaryAttribute) {
  if (levels.panel && levels.block) {
    const panel = levels.panel.join(', ');
    for (const [element, level] of current) {
      if (level !== 'panel') {
        continue;
      }
      let ancestor = element;
      while (
        ancestor &&
        ancestor !== root &&
        !(boundaryAttribute && ancestor.hasAttribute(boundaryAttribute))
      ) {
        ancestor = ancestor.parentElement;
        if (ancestor?.matches(panel)) {
          current.set(element, 'block');
          break;
        }
      }
    }
  }
}

function matchingHosts(root, levels, limits, boundaryAttribute) {
  const current = new Map();
  for (const [level, selectors] of Object.entries(levels)) {
    const selector = selectors.join(', ');
    if (root.matches?.(selector)) {
      current.set(root, level);
    }
    for (const element of root.querySelectorAll(selector)) {
      current.set(element, level);
    }
  }
  classifyBlocks(current, root, levels, boundaryAttribute);
  for (const [element, level] of current) {
    if (!limits.get(level).some((value) => value > 0)) {
      current.delete(element);
    }
  }
  return current;
}

function resizeRect(entry, view) {
  const box = entry.borderBoxSize?.[0];
  if (!box) {
    return entry.target.getBoundingClientRect();
  }
  const vertical = view
    .getComputedStyle(entry.target)
    .writingMode.startsWith('vertical');
  return {
    width: vertical ? box.blockSize : box.inlineSize,
    height: vertical ? box.inlineSize : box.blockSize,
  };
}

/** Opt-in threshold fitting. CSS handles continuous geometry; this helper only
 * marks hosts outside configured limits. It never computes paths or pixels.
 *
 * @param {Element|Document} root
 * @param {{levels: Record<string, string[]>, scope?: Element, prefix?: string, boundaryAttribute?: string,
 * ResizeObserver?: typeof ResizeObserver, MutationObserver?: typeof MutationObserver}} options
 */
export function observeFrameFit(root, options) {
  const { levels, prefix = 'frame' } = options;
  const scope = options.scope ?? root.documentElement ?? root;
  const view = scope.ownerDocument.defaultView;
  const Resize = options.ResizeObserver ?? view.ResizeObserver;
  const Mutation = options.MutationObserver ?? view.MutationObserver;
  const attribute = `data-${prefix}-fit`;
  const tracked = new Map();
  let observer = null;
  let disposed = false;
  let limits = new Map();
  const outside = (rect, limit) =>
    (limit[0] > 0 && rect.width < limit[0]) ||
    (limit[1] > 0 && rect.width > limit[1]) ||
    (limit[2] > 0 && rect.height < limit[2]) ||
    (limit[3] > 0 && rect.height > limit[3]);
  const mark = (element, rect) => {
    const item = tracked.get(element);
    if (!item) {
      return;
    }
    const value = outside(rect, limits.get(item.level)) ? 'outside' : null;
    if (element.getAttribute(attribute) === value) {
      return;
    }
    if (value === null) {
      element.removeAttribute(attribute);
    } else {
      element.setAttribute(attribute, value);
    }
  };
  const restore = (element, item) => {
    if (element.getAttribute(attribute) === item.original) {
      return;
    }
    if (item.original === null) {
      element.removeAttribute(attribute);
    } else {
      element.setAttribute(attribute, item.original);
    }
  };
  const refresh = () => {
    if (disposed) {
      return;
    }
    const style = view.getComputedStyle(scope);
    limits = new Map(
      Object.keys(levels).map((level) => [
        level,
        ['min-width', 'max-width', 'min-height', 'max-height'].map((key) => {
          const value = Number(
            style.getPropertyValue(`--${prefix}-${level}-${key}`).trim()
          );
          return Number.isFinite(value) && value >= 0 && value <= 1600
            ? value
            : 0;
        }),
      ])
    );
    const active = [...limits.values()].some((values) =>
      values.some((value) => value > 0)
    );
    if (!active) {
      observer?.disconnect();
      observer = null;
      for (const [element, item] of tracked) {
        restore(element, item);
      }
      tracked.clear();
      return;
    }
    if (!Resize) {
      throw new TypeError('Threshold fitting requires ResizeObserver');
    }
    if (!observer) {
      observer = new Resize((entries) => {
        for (const entry of entries) {
          const rect = resizeRect(entry, view);
          mark(entry.target, rect);
        }
      });
    }
    const current = matchingHosts(
      root,
      levels,
      limits,
      options.boundaryAttribute
    );
    for (const [element, item] of tracked) {
      if (!current.has(element)) {
        observer.unobserve(element);
        restore(element, item);
        tracked.delete(element);
      }
    }
    for (const [element, level] of current) {
      if (!tracked.has(element)) {
        tracked.set(element, {
          level,
          original: element.getAttribute(attribute),
        });
        observer.observe(element, { box: 'border-box' });
      } else {
        tracked.get(element).level = level;
      }
      mark(element, element.getBoundingClientRect());
    }
  };
  // Watch numeric controls on the scope and dynamically inserted/retagged hosts.
  const mutations = new Mutation((records) => {
    if (
      records.some(
        (record) =>
          record.type === 'childList' || record.attributeName !== attribute
      )
    ) {
      refresh();
    }
  });
  refresh();
  mutations.observe(root, { subtree: true, childList: true, attributes: true });
  if (scope !== root && !root.contains(scope)) {
    mutations.observe(scope, { attributes: true });
  }
  return {
    refresh,
    dispose() {
      if (disposed) {
        return;
      }
      disposed = true;
      observer?.disconnect();
      observer = null;
      mutations.disconnect();
      for (const [element, item] of tracked) {
        restore(element, item);
      }
      tracked.clear();
    },
  };
}
