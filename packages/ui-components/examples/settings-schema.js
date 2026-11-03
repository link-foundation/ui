import { readSchema, defineFieldType } from '@link-foundation/ui-settings';

// Applications own their custom types. The panel only supplies their controls.
defineFieldType('vector', {
  coerce: (_field, raw) => {
    const value = Array.isArray(raw) ? raw.map(Number) : [];
    return { ok: value.length === 2 && value.every(Number.isFinite), value };
  },
  equals: (a, b) => a.every((v, i) => v === b[i]),
});
defineFieldType('list', {
  coerce: (_field, raw) => {
    const value = Array.isArray(raw)
      ? raw
      : typeof raw === 'string'
        ? [raw]
        : [];
    return { ok: value.every((v) => typeof v === 'string'), value };
  },
});

export const schemaText = `settings-schema: schema
  version 1
appearance: section
  label Appearance
liquid.blur:
  type range
  label Blur
  default 18
  min 0
  max 40
  step 1
  unit px
  section appearance
  apply
    css-var --liquid-blur
theme.mode:
  type choice
  label Theme
  default auto
  options auto light dark
  section appearance
  apply
    data-attr theme-mode
accent:
  type color
  label Accent
  default '#6750a4'
  section appearance
  apply
    css-var --accent
content: section
  label Content
motion.reduce:
  type toggle
  label Reduce motion
  default false
  section content
  apply
    data-attr reduce-motion
title:
  type text
  label Title
  default Preview
  section content
  apply
    data-attr title
scale:
  type number
  label Scale
  default 1
  min 1
  max 3
  step 1
  section content
  apply
    css-var --scale
offset:
  type vector
  label Offset
  default 0 0
  section content
  apply
    data-attr offset
tags:
  type list
  label Tags
  default sample
  section content
  apply
    data-attr tags
preset calm
  label Calm
  set liquid.blur 24
  set theme.mode dark
`;
export const { schema, diagnostics } = readSchema(schemaText);
