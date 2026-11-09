import { formatLinks } from '@link-foundation/ui-core';
import { formatValue, equalValue } from '@link-foundation/ui-settings';
import { mountControls } from '../controls/index.js';
import { controlFor } from './control-for.js';

/** Mount the existing basic controls; vectors and chips compose native inputs. */
export function mountField(
  container,
  field,
  value,
  onChange,
  id,
  { messages } = {}
) {
  const doc = container.ownerDocument;
  const { element, props } = controlFor(field);
  const numberLabel = () =>
    messages?.text('number', { label: props.label }) ?? `${props.label} number`;
  if (element === 'vector' || element === 'chips') {
    return mountCollection(
      container,
      field,
      value,
      onChange,
      element,
      messages
    );
  }
  if (element === 'color-field') {
    props.rgb ??= true;
  }
  const editorLabels = () => {
    const names =
      element === 'number-field'
        ? ['increment', 'decrement']
        : element === 'color-field'
          ? ['palette', 'rgb', 'red', 'green', 'blue']
          : [];
    return Object.fromEntries(
      names
        .map((key) => [
          `${key}-label`,
          messages?.text(key, { label: props.label }),
        ])
        .filter(([, value]) => value !== undefined)
    );
  };
  Object.assign(props, editorLabels());
  const property = element === 'switch' ? 'checked' : 'value';
  const clauses = Object.entries(props)
    .filter(([key]) => !['options', 'unit'].includes(key))
    .map(([key, v]) => [key, ...(Array.isArray(v) ? v : [String(v)])]);
  const optionLabels = choiceLabels(field);
  const children =
    element === 'select'
      ? (field.options ?? []).map((v, i) => ({
          id: `${id}-option-${i}`,
          values: ['option', optionLabels.get(v) ?? v, ['value', v]],
        }))
      : [];
  const source = formatLinks([
    {
      id,
      values: [
        element,
        ...clauses,
        ...(value === null ? [] : [[property, ...formatValue(field, value)]]),
        ...children,
      ],
    },
  ]);
  const mounted = mountControls(container, source);
  let labelsRevision = messages?.revision;
  const change = (event) => onChange(event.detail.value);
  container.addEventListener('ui-change', change);
  let number;
  if (element === 'slider') {
    number = doc.createElement('input');
    number.type = 'number';
    number.setAttribute('aria-label', numberLabel());
    for (const key of ['min', 'max', 'step']) {
      if (field[key] !== undefined) {
        number[key] = field[key];
      }
    }
    number.value = String(value);
    number.addEventListener('input', () =>
      onChange(number.value === '' ? null : Number(number.value))
    );
    container.append(number);
  }
  return {
    update(next) {
      if (labelsRevision !== messages?.revision) {
        labelsRevision = messages?.revision;
        for (const [key, label] of Object.entries(editorLabels())) {
          mounted.store.setProp(id, key, [label]);
        }
      }
      if (number) {
        number.setAttribute('aria-label', numberLabel());
      }
      if (next === null) {
        mounted.store.removeProp(id, property);
      } else {
        mounted.store.setProp(id, property, formatValue(field, next));
      }
      if (number) {
        number.value = String(next);
      }
    },
    destroy() {
      container.removeEventListener('ui-change', change);
      mounted.destroy();
    },
  };
}

function mountCollection(container, field, value, onChange, element, messages) {
  const doc = container.ownerDocument;
  let current = value;
  let lastMessages = messages?.revision;
  const render = () => {
    container.replaceChildren();
    const group = doc.createElement('fieldset');
    const legend = doc.createElement('legend');
    legend.textContent = field.label ?? field.key;
    group.append(legend);
    for (const [index, item] of current.entries()) {
      if (element === 'vector') {
        const input = doc.createElement('input');
        input.type = 'number';
        input.value = String(item);
        input.setAttribute('aria-label', `${legend.textContent} ${index + 1}`);
        input.addEventListener('change', () =>
          onChange(
            current.map((v, i) => (i === index ? Number(input.value) : v))
          )
        );
        group.append(input);
      } else {
        const chip = doc.createElement('button');
        chip.type = 'button';
        chip.textContent = `${item} ×`;
        chip.setAttribute(
          'aria-label',
          messages?.text('remove', { label: item }) ?? `Remove ${item}`
        );
        chip.addEventListener('click', () =>
          onChange(current.filter((_, i) => i !== index))
        );
        group.append(chip);
      }
    }
    if (element === 'chips') {
      const input = doc.createElement('input');
      input.setAttribute(
        'aria-label',
        messages?.text('add', { label: legend.textContent }) ??
          `Add ${legend.textContent}`
      );
      const add = doc.createElement('button');
      add.type = 'button';
      add.textContent =
        messages?.text('add', { label: legend.textContent }) ??
        `Add ${legend.textContent}`;
      add.addEventListener('click', () => {
        if (input.value.trim()) {
          onChange([...current, input.value.trim()]);
        }
      });
      group.append(input, add);
    }
    container.append(group);
  };
  render();
  return {
    update(next) {
      const nextMessages = messages?.revision;
      if (equalValue(field, current, next) && lastMessages === nextMessages) {
        return;
      }
      lastMessages = nextMessages;
      current = next;
      render();
    },
    destroy() {
      container.replaceChildren();
    },
  };
}

function choiceLabels(field) {
  const labels = field.props['option-labels'];
  const pairs = Array.isArray(labels?.[0]) ? labels : [labels];
  return new Map(
    pairs.filter((pair) => Array.isArray(pair) && pair.length === 2)
  );
}
