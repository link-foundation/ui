import { readSchema } from '@link-foundation/ui-settings';
import { createSettingsPanel } from '../src/settings/index.js';

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
    container.append(frame);
    return {
      update: (values) => {
        frame.style.borderRadius = `${values.radius}px`;
        frame.style.borderColor = values.accent;
      },
    };
  },
});
document.querySelector('#panel').append(panel.element);
globalThis.panel = panel;
document.body.dataset.ready = 'true';
