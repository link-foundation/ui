import { partOf, setText, textOf, flagOf } from './dom.js';
import { parseHex } from './color.js';

const CHANNELS = ['red', 'green', 'blue'];

/** Optional grouped sliders and integer editors share the color-field value. */
export function createRgb(doc, node, getControl) {
  const group = partOf(doc, 'div', 'rgb', { role: 'group', hidden: '' });
  const inputs = [];
  for (const name of CHANNELS) {
    const row = partOf(doc, 'div', null);
    const caption = partOf(doc, 'span', null);
    setText(caption, name);
    row.appendChild(caption);
    for (const type of ['range', 'number']) {
      const input = partOf(doc, 'input', `${name}-${type}`, {
        type,
        min: '0',
        max: '255',
        step: '1',
        value: '0',
      });
      input.addEventListener('input', () => {
        const control = getControl();
        if (
          control.service.context.disabled ||
          control.service.context.readonly ||
          input.value === ''
        ) {
          return;
        }
        const value = Number(input.value);
        if (!Number.isFinite(value)) {
          return;
        }
        const color = parseHex(control.service.context.value) ?? {
          r: 0,
          g: 0,
          b: 0,
        };
        color[name[0]] = Math.min(255, Math.max(0, Math.round(value)));
        const hex = `#${Object.values(color)
          .map((n) => n.toString(16).padStart(2, '0'))
          .join('')}`;
        control.assign({ value: hex, invalid: false });
      });
      row.appendChild(input);
      inputs.push({ name, type, input });
    }
    group.appendChild(row);
  }
  node.appendChild(group);
  return { rgb: group, rgbInputs: inputs };
}

export function renderRgb(control) {
  const color = parseHex(control.service.context.value) ?? { r: 0, g: 0, b: 0 };
  for (const { name, input } of control.parts.rgbInputs) {
    input.value = String(color[name[0]]);
  }
}

export function updateRgb(control, el) {
  const label = textOf(el, 'label') || el.id;
  const group = control.parts.rgb;
  group.toggleAttribute('hidden', !flagOf(el, 'rgb'));
  group.setAttribute('aria-label', textOf(el, 'rgb-label') || `${label} RGB`);
  for (const { name, type, input } of control.parts.rgbInputs) {
    const nameLabel = textOf(el, `${name}-label`) || `${label} ${name}`;
    input.setAttribute(
      'aria-label',
      type === 'number' ? `${nameLabel} (0–255)` : nameLabel
    );
    setText(input.parentNode.firstChild, textOf(el, `${name}-label`) || name);
    input.toggleAttribute(
      'disabled',
      flagOf(el, 'disabled') || flagOf(el, 'readonly')
    );
  }
}
