// Can a UI document be embedded as `(document ...links)` and read back?
import {
  format,
  formatLinks,
  parse,
  parseLinks,
} from '@link-foundation/ui-core';
import { samples, shape } from '../packages/ui-core/tests/helpers.js';
import { isDeepStrictEqual } from 'node:util';
for (const { name, text } of samples()) {
  const doc = parse(text);
  const links = parseLinks(format(doc, { style: 'inline' }));
  const bundle = formatLinks([['document', ...links]]);
  const [embedded] = parseLinks(bundle);
  const back = parse(formatLinks(embedded.slice(1)));
  console.log(name, isDeepStrictEqual(shape(back), shape(doc)));
}
