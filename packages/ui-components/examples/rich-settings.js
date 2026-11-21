import { readSchema } from '@link-foundation/ui-settings';
import { createSettingsPanel, mountField } from '../src/settings/index.js';

const { schema } = readSchema(
  `demo: schema
  version 1
frame: section
  label Frame
  tabs Shape Fit
appearance: section
  label Appearance
show-frame:
  type toggle
  label 'Show frame'
  default true
  section frame
radius:
  type number
  label Radius
  default 12
  min 0
  max 40
  unit px
  section frame
  tab Shape
  visible-when show-frame true
  preview frame
  group Shape
frame-art:
  type choice
  label 'Frame artwork'
  options clear orbit
  default clear
  section frame
  tab Shape
  visible-when show-frame true
width:
  type number
  label Width
  default 200
  min 80
  max 400
  section frame
  tab Fit
  group Dimensions
limit:
  type number
  label 'Fit limit'
  default 300
  min 80
  max 400
  section frame
  tab Fit
  group Dimensions
accent:
  type color
  label Accent
  default '#6750a4'
  section appearance
  palette
    Purple '#6750a4'
    Ocean '#1256ab'
motion:
  type toggle
  label 'Reduce motion'
  default false
  section appearance
  comfort`,
  { normalization: { primitives: 'strict', numbers: 'clamp' } }
);

const panel = createSettingsPanel(schema, {
  columns: 2,
  renderSection: ({ section }) => {
    const name = document.createElement('strong');
    name.textContent = section.label;
    return name;
  },
  renderTab: ({ value, selected }) => (selected ? `✓ ${value}` : value),
  slots: {
    value: ({ field, value }) =>
      field.key === 'frame-art'
        ? value === 'orbit'
          ? 'Orbit pattern'
          : 'Clear'
        : undefined,
    hint: ({ field }) =>
      field.key === 'frame-art'
        ? 'Choose a pattern for the preview frame.'
        : field.description,
  },
  mountControl(container, field, value, change, id, context) {
    if (field.key !== 'frame-art') {
      return mountField(container, field, value, change, id, context);
    }
    const select = document.createElement('select');
    select.id = `${id}-artwork`;
    for (const [value, label] of [
      ['clear', 'Clear'],
      ['orbit', 'Orbit pattern'],
    ]) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = label;
      select.add(option);
    }
    select.value = value;
    select.addEventListener('change', () => change(select.value));
    container.append(select);
    return {
      element: select,
      update: (next) => {
        select.value = next;
      },
      destroy: () => select.remove(),
    };
  },
  values: { radius: 18 },
  randomLocked: ['limit'],
  formatCount: (model) =>
    `${model.changedCount} custom · ${model.visibleCount} visible`,
  normalizeChanges: (next) => ({
    ...next,
    width: Math.min(next.width, next.limit),
  }),
  mountPreview: ({ container }) => {
    container.className = 'frame-preview';
    const frame = document.createElement('span');
    frame.textContent = 'Transparent frame';
    const play = document.createElement('button');
    play.type = 'button';
    play.textContent = 'Play preview';
    play.setAttribute('aria-pressed', 'false');
    play.addEventListener('click', () => {
      const pressed = play.getAttribute('aria-pressed') !== 'true';
      play.setAttribute('aria-pressed', String(pressed));
      frame.classList.toggle('inset-preview', pressed);
    });
    container.append(frame, play);
    return {
      update: (values) => {
        frame.style.borderRadius = `${values.radius}px`;
        frame.style.borderColor = values.accent;
        frame.classList.toggle(
          'orbit-preview',
          values['frame-art'] === 'orbit'
        );
      },
    };
  },
});
document.querySelector('#panel').append(panel.element);
globalThis.panel = panel;
document.body.dataset.ready = 'true';
