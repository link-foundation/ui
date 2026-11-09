import {
  readSchema,
  bindConfig,
  toShareHash,
} from '@link-foundation/ui-settings';
import { createConfig, persistLayer } from '@link-foundation/ui-config';
import { parse } from '@link-foundation/ui-core';
import { createSettingsPanel } from '../src/settings/index.js';

export const { schema } = readSchema(`settings-schema: schema
  version 1
appearance: section
  label Appearance
  description 'Choose a material, then tune its colour and size.'
  tabs Material Typography Empty
  levels base expert
  preview material
  presets soft
accent:
  type color
  default '#6750a4'
  label Accent
  section appearance
  tab Material
  mode popover
  palettes
    name Violet
    colors
      (name Iris) (hex '#6750a4')
      (name Plum) (hex '#774477')
scale:
  type number
  label Scale
  default 1
  min 0.5
  max 2
  step 0.1
  random
    min 0.8
    max 1.4
  section appearance
  tab Typography
weight:
  type number
  label Weight
  default null
  inherit true
  fallback 4
  min 0
  max 10
  section appearance
  level expert
layout: section
  label Layout
  description 'Stable estimates keep your section in place while editing.'
spacing:
  type number
  default 8
  min 0
  max 32
  section layout
details:
  type toggle
  label Show details
  default false
  section layout
advanced: section
  label Details
  visible-when details
radius:
  type number
  default 12
  section advanced
motion: section
  label Motion
speed:
  type range
  default 4
  min 0
  max 10
  section motion
  random not-heavier-than-default
comfort:
  type toggle
  label Reduced motion
  default false
  comfort
  section motion
text: section
  label Text
title:
  type text
  default Hello
  section text
shape: section
  label Shape
corners:
  type choice
  default round
  options round square
  section shape
contrast: section
  label Contrast
strength:
  type number
  default 3
  min 0
  max 10
  description 'Keep enough contrast for comfortable reading.'
  section contrast
preset soft
  label Soft violet
  description 'A calm material without changing layout or text.'
  partial
  set accent '#774477'
preset large
  label Large type
  description 'More space for reading.'
  partial
  set scale 1.4`);

const config = createConfig({
  document: parse('app: document\n  settings: group'),
});
const target = bindConfig(config, schema);
const persistence = persistLayer(
  config,
  'user',
  localStorage,
  'settings-gallery',
  { sync: true }
);
const project = (values) => ({
  css: { '--accent': values.accent, '--scale': values.scale },
});
const panel = createSettingsPanel(schema, {
  target,
  sharedHash: location.hash || undefined,
  columns: { count: 3, balance: 'estimate' },
  presets: { display: 'cards' },
  peek: 'toggle',
  previewRoot: document.querySelector('#preview'),
  project,
  looksStorageKey: 'settings-gallery-looks',
  mountPreview({ container }) {
    const sample = document.createElement('p');
    container.append(sample);
    return {
      update(values, section, level) {
        sample.textContent = `${section.label} · ${level}`;
        sample.style.borderBottom = `3px solid ${values.accent}`;
      },
    };
  },
  mountMiniature({ container }) {
    const sample = document.createElement('span');
    sample.className = 'sample';
    sample.textContent = 'Aa · Preview';
    container.append(sample);
    return {
      update(values) {
        sample.style.background = values.accent;
        sample.style.color = '#ffffff';
        sample.style.fontSize = `${values.scale}rem`;
      },
    };
  },
});
document.querySelector('#panel').append(panel.element);
document
  .querySelector('#open')
  .addEventListener('click', (event) => panel.open(event.currentTarget));
window.panel = panel;
window.gallery = { schema, target, config, toShareHash, persistence };
