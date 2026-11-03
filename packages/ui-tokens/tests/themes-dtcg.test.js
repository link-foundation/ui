/* global URL, structuredClone */
import { it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import Ajv from 'ajv';
import { loadTheme } from '../../ui-themes/src/index.js';
import { exportThemeResolver } from '../src/themes/index.js';

it('validates every combined mode against the official DTCG 2025.10 Resolver schema offline', async () => {
  const folder = new URL(
    '../../../assets/data/dtcg-resolver/',
    import.meta.url
  );
  const schemas = readdirSync(folder)
    .filter((name) => name.endsWith('.json'))
    .map((name) => JSON.parse(readFileSync(new URL(name, folder), 'utf8')));
  const ajv = new Ajv({ allErrors: true, schemaId: 'auto' });
  ajv.addSchema(schemas);
  const validate = ajv.getSchema(
    'https://www.designtokens.org/schemas/2025.10/resolver.json'
  );
  const doc = exportThemeResolver(await loadTheme('base'));
  assert.equal(validate(doc), true, JSON.stringify(validate.errors));
  const contexts = doc.modifiers.mode.contexts;
  assert.equal(Object.keys(contexts).length, 8);
  assert.equal(contexts.dark[0].color.surface.$value.hex, '#121316');
  assert.equal(
    contexts['dark-reduced'][0].motion.duration.short.$value.value,
    0
  );
  const invalid = structuredClone(doc);
  invalid.version = '2020.01';
  assert.equal(validate(invalid), false);
});
