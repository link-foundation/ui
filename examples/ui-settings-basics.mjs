// Usage of @link-foundation/ui-settings: read a settings schema written in
// Links Notation, merge untrusted values, write a diff-only values document
// and a share link, read the share links of the earlier sites, apply a
// preset, randomise a look, keep the values in the user layer of ui-config
// and build the before-paint script with its CSP hash.
// Run: node examples/ui-settings-basics.mjs
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import {
  activePreset,
  applyPreset,
  beforePaintScript,
  beforePaintScriptHash,
  bindConfig,
  diff,
  fromShareHash,
  merge,
  randomize,
  readSchema,
  toLino,
  toShareHash,
} from '@link-foundation/ui-settings';

const { schema, diagnostics } =
  readSchema(`(settings-schema: schema (version 2))
(appearance: section (label 'Appearance'))
(liquid.blur: (type range) (default 18) (min 0) (max 40) (step 1) (unit px)
  (section appearance) (label 'Blur') (apply (css-var --liquid-blur)))
(theme.mode: (type choice) (default auto) (options auto light dark)
  (section appearance) (apply (data-attr theme-mode)))
(motion.reduce: (type toggle) (default false) (section appearance) (comfort))
(accent: (type color) (default '#3390EC') (apply (css-var --accent)))
(preset calm (label 'Calm') (set liquid.blur 24) (set theme.mode dark))
(migration (from 1) (to 2) (rename blur liquid.blur) (old-default liquid.blur 12))`);
console.log(schema.fields.size, diagnostics);
// 4 []

const { values, rejected } = merge(schema, undefined, {
  'liquid.blur': 24,
  evil: 'x',
  'theme.mode': 7,
});
console.log(rejected);
// [ 'evil', 'theme.mode' ]
console.log(toLino(schema, diff(schema, values)));
// (settings (version 2) (liquid.blur 24))
console.log(toShareHash(schema, values));
// #settings=(settings%20(version%202)%20(liquid.blur%2024))

// Links of the earlier sites still open.
const old = fromShareHash(schema, '#settings={"liquid.blur":30}');
console.log(old.format, old.values['liquid.blur']);
// konard-json 30

const calm = applyPreset(schema, { 'motion.reduce': true }, 'calm');
console.log(activePreset(schema, calm), calm['motion.reduce']);
// calm true

// The same seed always gives the same look; comfort settings never change.
let seed = 42;
const random = () => {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
};
console.log(randomize(schema, calm, { random, locked: ['accent'] }));

// Values are user overrides of the `settings` element of a document.
const config = createConfig({
  document: parse(`(app: document
  (settings: group))`),
});
const settings = bindConfig(config, schema);
settings.update({ 'liquid.blur': 24, 'theme.mode': 'dark' });
console.log(config.exportPatch());
// (user-overrides: overrides
//   (layer user)
//   (base app)
//   (set settings liquid.blur 24)
//   (set settings theme.mode dark))

const script = beforePaintScript(schema);
console.log(script.length, await beforePaintScriptHash(script));
