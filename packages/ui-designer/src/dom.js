/** Small DOM helpers scoped to one designer instance. */
export function element(document, tag, attributes = {}, text) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attributes)) {
    node.setAttribute(key, String(value));
  }
  if (text !== undefined) {
    node.textContent = text;
  }
  return node;
}

export const editable = (target) =>
  !!target?.closest?.('input,textarea,select,[contenteditable=true]');

/** Listen with one lifetime controller, including events attached to the document. */
export function listen(target, type, callback, controller, capture = false) {
  target.addEventListener(type, callback, {
    signal: controller.signal,
    capture,
  });
}
