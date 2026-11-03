import { formatLinks } from '@link-foundation/ui-core';
import { formatValue, equalValue } from '@link-foundation/ui-settings';
import { mountControls } from '../controls/index.js';
import { controlFor } from './control-for.js';

/** Mount the existing basic controls; vectors and chips compose native inputs. */
export function mountField(container, field, value, onChange, id) {
  const doc = container.ownerDocument;
  const { element, props } = controlFor(field);
  if (element === 'vector' || element === 'chips') {
    return mountCollection(container, field, value, onChange, element);
  }
  const property = element === 'switch' ? 'checked' : 'value';
  const clauses = Object.entries(props)
    .filter(([key]) => !['options', 'unit'].includes(key))
    .map(([key, v]) => [key, String(v)]);
  const children =
    element === 'select'
      ? (field.options ?? []).map((v, i) => ({
          id: `${id}-option-${i}`,
          values: ['option', v, ['value', v]],
        }))
      : [];
  const source = formatLinks([
    {
      id,
      values: [
        element,
        ...clauses,
        [property, ...formatValue(field, value)],
        ...children,
      ],
    },
  ]);
  const mounted = mountControls(container, source);
  const change = (event) => onChange(event.detail.value);
  container.addEventListener('ui-change', change);
  let number;
  if (element === 'slider') {
    number = doc.createElement('input');
    number.type = 'number';
    number.setAttribute('aria-label', `${props.label} number`);
    for (const key of ['min', 'max', 'step']) {
      if (field[key] !== undefined) {
        number[key] = field[key];
      }
    }
    number.value = String(value);
    number.addEventListener('change', () => onChange(number.value));
    container.append(number);
  }
  return {
    update(next) {
      mounted.store.setProp(id, property, formatValue(field, next));
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

function mountCollection(container, field, value, onChange, element) {
  const doc = container.ownerDocument;
  let current = value;
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
        chip.setAttribute('aria-label', `Remove ${item}`);
        chip.addEventListener('click', () =>
          onChange(current.filter((_, i) => i !== index))
        );
        group.append(chip);
      }
    }
    if (element === 'chips') {
      const input = doc.createElement('input');
      input.setAttribute('aria-label', `Add ${legend.textContent}`);
      const add = doc.createElement('button');
      add.type = 'button';
      add.textContent = `Add ${legend.textContent}`;
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
      if (equalValue(field, current, next)) {
        return;
      }
      current = next;
      render();
    },
    destroy() {
      container.replaceChildren();
    },
  };
}
