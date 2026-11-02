// Export the issue's handwritten dot/dot-pulse LiNo to Lottie and validate it.
import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { exportLottie } from '../../packages/ui-convert/src/interop/lottie/index.js';
import { readLino } from '../../packages/ui-convert/src/interop/lino.js';

const file = new URL(
  '../../packages/ui-convert/tests/fixtures/interop/lottie/dot-pulse.lino',
  import.meta.url
);
const doc = readLino(readFileSync(file, 'utf8'));
console.log('parse diagnostics', JSON.stringify(doc.diagnostics));
const { json, diagnostics } = exportLottie(doc, 'dot-pulse');
console.log(JSON.stringify(json, null, 1));
console.log('export diagnostics', JSON.stringify(diagnostics));
const require = createRequire(
  new URL('../../packages/ui-convert/package.json', import.meta.url)
);
const { Ajv2020 } = require('ajv/dist/2020');
const {
  LottieValidator,
  get_schema_path,
} = require('@lottie-animation-community/lottie-specs/src/validator-node.js');
const schema = JSON.parse(readFileSync(get_schema_path(), 'utf8'));
const errors = new LottieValidator(Ajv2020, schema)
  .validate(json)
  .filter((e) => e.type === 'error');
console.log(errors.length ? errors : 'VALID');
