import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
export const fixture = (name, extension = 'lino') =>
  readFileSync(
    new URL(`./fixtures/${name}.${extension}`, import.meta.url),
    'utf8'
  );
export const fixtures = ['document', 'form', 'unsupported'];
