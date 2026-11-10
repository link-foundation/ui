export function element(doc, tag, text, parent) {
  const node = doc.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  parent?.append(node);
  return node;
}
export function button(doc, parent, label, action) {
  const node = element(doc, 'button', label, parent);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}
export function field(doc, parent, label, type = 'text') {
  const wrapper = element(doc, 'label', undefined, parent);
  element(doc, 'span', label, wrapper);
  const input = element(
    doc,
    type === 'select' ? 'select' : 'input',
    undefined,
    wrapper
  );
  // Keep feedback and numeric outputs out of the control's accessible name.
  input.setAttribute('aria-label', label);
  if (type !== 'select') {
    input.type = type;
  }
  return input;
}
export function choices(doc, select, values) {
  for (const [value, label] of values) {
    const option = element(doc, 'option', label, select);
    option.value = value;
  }
}
