import { equalValue, merge } from '@link-foundation/ui-settings';
import { uid } from '../layout/dom.js';
import { mountField } from './field-control.js';
import { createMessages } from './messages.js';

function element(parent, tag, text) {
  const node = parent.ownerDocument.createElement(tag);
  if (text !== undefined) {
    node.textContent = text;
  }
  parent.append(node);
  return node;
}

function associate(input, { id, label, hint, output, useLabel }) {
  if (!input) {
    return;
  }
  input.id ||= `${id}-input`;
  label.htmlFor = input.id;
  output.htmlFor.value = input.id;
  const hasInlineLabel = Array.from(input.labels ?? []).some(
    (other) => other !== label
  );
  if (
    useLabel ||
    (hasInlineLabel &&
      !input.hasAttribute('aria-label') &&
      !input.hasAttribute('aria-labelledby'))
  ) {
    input.setAttribute('aria-labelledby', label.id);
  }
  if (hint) {
    const descriptions = (input.getAttribute('aria-describedby') ?? '')
      .split(/\s+/)
      .filter(Boolean);
    input.setAttribute(
      'aria-describedby',
      [...new Set([...descriptions, hint.id])].join(' ')
    );
  }
}

/** Mount a validated field row in host-owned DOM. */
export function mountSettingsRow(container, schema, field, options = {}) {
  const messages = createMessages(options.messages);
  const context = { ...options, messages };
  let values = merge(schema, options.values, undefined).values;
  let render = () => {};
  const row = createFieldRow(container, field, context, values, (value) => {
    const result = merge(schema, values, { [field.key]: value });
    if (result.rejected.length) {
      render(values);
      return;
    }
    if (
      options.onChange?.({ [field.key]: result.values[field.key] }) !== false
    ) {
      values = result.values;
    }
    render(values);
  });
  render = row.update;
  return {
    element: row.element,
    update(next, state) {
      values = merge(schema, next, undefined).values;
      row.update(values, state);
    },
    setMessages(catalog) {
      messages.update(catalog);
      row.update(values);
    },
    destroy: row.destroy,
  };
}

export function createFieldRow(parent, field, context, initial, change) {
  const { slots = {}, layout, mountControl, mountPreview, messages } = context;
  const id = context.id ?? uid('settings-field');
  const row = element(parent, 'div');
  row.className = 'settings-row';
  row.dataset.key = field.key;
  const title = element(row, 'div');
  const label = element(title, 'label', field.label ?? field.key);
  label.className = 'settings-label';
  label.id = `${id}-label`;
  const hint =
    field.description || slots.hint
      ? element(title, 'p', field.description)
      : null;
  if (hint) {
    hint.id = `${id}-hint`;
  }
  const container = element(row, 'div');
  container.className = 'settings-control';
  const details = { field, id, labelId: label.id, hintId: hint?.id, messages };
  let peeking = false;
  const commit = (value) => {
    if (!peeking) {
      change(value);
    }
  };
  const current = (mountControl ?? mountField)(
    container,
    field,
    initial[field.key],
    commit,
    id,
    details
  );
  const output = element(row, 'output');
  function associateControl() {
    const input =
      current.element ??
      container.querySelector('[data-part="input"]') ??
      container.querySelector('input, select, textarea, button');
    associate(input, {
      id,
      label,
      hint,
      output,
      useLabel:
        slots.label ||
        (mountControl &&
          !input?.matches(
            'button, input, select, textarea, meter, output, progress'
          )),
    });
  }
  const params = { label: field.label ?? field.key };
  messages.attr(output, 'aria-label', 'value', params);
  const marker = element(title, 'span');
  marker.className = 'settings-changed';
  messages.bind(() => {
    marker.textContent = messages.text('changed');
  }, marker);
  const reset = element(row, 'button');
  reset.type = 'button';
  reset.addEventListener('click', () => commit(field.default));
  const resetLabel = () => messages.text('reset', params);
  messages.bind(() => {
    reset.setAttribute('aria-label', resetLabel());
    if (!slots.reset) {
      reset.textContent = resetLabel();
    }
  }, reset);
  const previewContainer =
    field.props.preview && mountPreview ? element(row, 'div') : null;
  const preview =
    previewContainer &&
    mountPreview({ container: previewContainer, field, values: initial });
  layout?.({
    row,
    label,
    control: container,
    value: output,
    reset,
    hint,
    marker,
    preview: previewContainer,
    field,
    id,
  });

  function updateSlots(state) {
    const { value } = state;
    if (slots.label) {
      label.replaceChildren(slots.label(state) ?? params.label);
    }
    if (slots.hint) {
      hint.replaceChildren(slots.hint(state) ?? field.description ?? '');
    }
    if (slots.reset) {
      reset.replaceChildren(slots.reset(state) ?? state.resetLabel);
    }
    const formatted = Array.isArray(value) ? value.join(', ') : value;
    output.replaceChildren(
      slots.value?.(state) ?? `${formatted}${field.unit ?? ''}`
    );
  }

  function update(
    values,
    { shown = values, visible = true, peek = false, updateControl = true } = {}
  ) {
    peeking = peek;
    const changed = !equalValue(field, values[field.key], field.default);
    row.hidden = !visible;
    row.toggleAttribute('data-changed', changed);
    reset.disabled = !changed || peek;
    marker.hidden = !changed;
    const value = shown[field.key];
    const state = {
      ...details,
      values: shown,
      value,
      changed,
      peeking,
      commit,
      resetLabel: resetLabel(),
    };
    updateSlots(state);
    preview?.update?.(shown, field);
    if (updateControl) {
      current.update(value);
    }
    associateControl();
  }

  update(initial, { updateControl: false });
  return {
    element: row,
    update,
    destroy() {
      current.destroy();
      preview?.destroy?.();
      messages.release(row);
      row.remove();
    },
  };
}
