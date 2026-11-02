// Round trip Lottie files: import -> LiNo -> parse -> export, compare with
// the normalised input and validate the export against the lottie-spec
// schema. Usage: node lottie-roundtrip.mjs <file.json>...
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import {
  exportLottie,
  importLottie,
  normalizeLottie,
} from '../../packages/ui-convert/src/interop/lottie/index.js';
import { readLino } from '../../packages/ui-convert/src/interop/lino.js';

const require = createRequire(
  new URL('../../packages/ui-convert/package.json', import.meta.url)
);
const { Ajv2020 } = require('ajv/dist/2020');
const {
  LottieValidator,
  get_schema_path: getSchemaPath,
} = require('@lottie-animation-community/lottie-specs/src/validator-node.js');
const schema = JSON.parse(readFileSync(getSchemaPath(), 'utf8'));
const validator = new LottieValidator(Ajv2020, schema);

const diff = (a, b, path = '') => {
  if (isDeepStrictEqual(a, b)) {
    return [];
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => diff(a[k], b[k], `${path}/${k}`));
  }
  return [`${path}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`];
};

for (const file of process.argv.slice(2)) {
  const json = JSON.parse(readFileSync(file, 'utf8'));
  const imported = importLottie(json);
  console.log(`== ${file}`);
  if (process.env.SHOW) {
    console.log(imported.lino);
  }
  for (const d of imported.diagnostics) {
    console.log(`  import ${d.severity} ${d.code} ${d.at.path ?? ''}`);
  }
  const parsed = readLino(imported.lino);
  for (const d of parsed.diagnostics) {
    console.log(`  parse ${d.severity} ${d.code} ${d.message}`);
  }
  const exported = exportLottie(imported.lino);
  for (const d of exported.diagnostics) {
    console.log(`  export ${d.severity} ${d.code} ${d.message}`);
  }
  const problems = diff(normalizeLottie(json), exported.json);
  console.log(
    problems.length === 0 ? '  ROUND TRIP OK' : problems.slice(0, 10).join('\n')
  );
  const errors = validator
    .validate(exported.json)
    .filter((e) => e.type === 'error');
  console.log(
    errors.length === 0 ? '  VALID' : JSON.stringify(errors.slice(0, 5))
  );
}
