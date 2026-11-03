/**
 * Announcements for screen readers through one shared live region per
 * document: a visually hidden container with a polite region
 * (`role="status"`) and an assertive one (`role="alert"`). Each message is
 * a new node, so the same text said twice is announced twice.
 */

const REGION_ID = 'ui-live-region';

/** Visually hidden but read by screen readers. */
const VISUALLY_HIDDEN = [
  'position: absolute',
  'width: 1px',
  'height: 1px',
  'margin: -1px',
  'padding: 0',
  'border: 0',
  'overflow: hidden',
  'clip: rect(0 0 0 0)',
  'clip-path: inset(50%)',
  'white-space: nowrap',
].join('; ');

const POLITENESS = {
  polite: 'status',
  assertive: 'alert',
};

/**
 * The shared live region of a document, created on first use.
 * @param {Document} document
 * @returns {HTMLElement}
 */
export function liveRegion(document) {
  const found = document.getElementById(REGION_ID);
  if (found) {
    return found;
  }
  const container = document.createElement('div');
  container.id = REGION_ID;
  container.setAttribute('style', VISUALLY_HIDDEN);
  for (const [politeness, role] of Object.entries(POLITENESS)) {
    const region = document.createElement('div');
    region.setAttribute('role', role);
    region.setAttribute('aria-live', politeness);
    region.setAttribute('aria-atomic', 'true');
    region.dataset.politeness = politeness;
    container.appendChild(region);
  }
  document.body.appendChild(container);
  return container;
}

/**
 * Announce a message.
 * @param {string} message
 * @param {{politeness?: 'polite'|'assertive', document?: Document}} [options]
 *   `politeness` (default `polite`); `document` (default the global one)
 * @returns {HTMLElement}  the node that holds the message
 */
export function announce(message, options = {}) {
  const { politeness = 'polite' } = options;
  if (!Object.hasOwn(POLITENESS, politeness)) {
    throw new TypeError(
      `announce: politeness must be "polite" or "assertive", not ${JSON.stringify(politeness)}`
    );
  }
  const document = options.document ?? globalThis.document;
  const region = liveRegion(document).querySelector(
    `[data-politeness="${politeness}"]`
  );
  const node = document.createElement('div');
  node.textContent = String(message);
  region.replaceChildren(node);
  return node;
}

/**
 * Remove the messages of the live region (the region itself stays, as
 * screen readers track it).
 * @param {Document} [document]
 */
export function clearAnnouncements(document = globalThis.document) {
  const container = document.getElementById(REGION_ID);
  for (const region of container?.children ?? []) {
    region.replaceChildren();
  }
}
