/** Screen-only, high-priority suppression without mutating the original declarations. */
export function observeMaterialVisibility(
  root,
  selector,
  { margin = '200px 0px', onVisibility } = {}
) {
  const document = root.ownerDocument ?? root;
  const view = document.defaultView;
  if (!view?.IntersectionObserver) {
    return { dispose() {} };
  }
  let suffix = 0;
  while (document.querySelector(`style[data-material-budget="${suffix}"]`)) {
    suffix++;
  }
  const marker = `data-ui-material-hidden-${suffix}`;
  const style = document.createElement('style');
  style.setAttribute('data-material-budget', String(suffix));
  // An inline important rule also applies in print, so use an author stylesheet.
  // Repeated IDs make this override every framework selector, including hover.
  const priority = ':is(#ui-budget#ui-budget#ui-budget, *)';
  style.textContent = `@media screen { [${marker}]${priority} { backdrop-filter: none !important; -webkit-backdrop-filter: none !important; } }`;
  (document.head ?? document.documentElement).append(style);
  const tracked = new Map();
  const observer = new view.IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!tracked.has(entry.target)) {
          continue;
        }
        entry.target.toggleAttribute(marker, !entry.isIntersecting);
        onVisibility?.(entry.target, entry.isIntersecting);
      }
    },
    { rootMargin: typeof margin === 'number' ? `${margin}px 0px` : margin }
  );
  const remove = (element) => {
    if (!tracked.has(element)) {
      return;
    }
    observer.unobserve(element);
    element.removeAttribute(marker);
    tracked.delete(element);
  };
  const scan = (node, add) => {
    if (node.nodeType !== 1 && node !== root) {
      return;
    }
    const visit = (element) => {
      if (!add) {
        remove(element);
        return;
      }
      if (tracked.has(element)) {
        return;
      }
      tracked.set(element, true);
      element.setAttribute(marker, '');
      observer.observe(element);
    };
    // Visible nodes have no suppression marker; release them even if their
    // selector attributes changed before removal.
    const query = add ? selector : '*';
    if (node.matches?.(query)) {
      visit(node);
    }
    node.querySelectorAll(query).forEach(visit);
  };
  scan(root, true);
  const mutations = new view.MutationObserver((records) => {
    for (const record of records) {
      for (const node of record.removedNodes) {
        if (!root.contains(node)) {
          scan(node, false);
        }
      }
      for (const node of record.addedNodes) {
        scan(node, true);
      }
    }
  });
  mutations.observe(root, { childList: true, subtree: true });
  return {
    dispose() {
      mutations.disconnect();
      observer.disconnect();
      for (const element of tracked.keys()) {
        element.removeAttribute(marker);
      }
      tracked.clear();
      style.remove();
    },
  };
}
