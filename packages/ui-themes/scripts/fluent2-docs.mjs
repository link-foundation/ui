import { readFile, writeFile } from 'node:fs/promises';
import { URL, fileURLToPath } from 'node:url';
import process from 'node:process';
import { format } from 'prettier';
import { loadMapping, mappingMarkdown } from '../src/mapping.js';
export async function fluentMappingTable() {
  return format(
    mappingMarkdown(
      loadMapping(
        await readFile(
          new URL('../themes/fluent2/fluent-mapping.lino', import.meta.url),
          'utf8'
        )
      )
    ),
    { parser: 'markdown' }
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const url = new URL('../../../docs/themes/fluent2.md', import.meta.url);
  const text = await readFile(url, 'utf8');
  const [before, rest] = text.split('<!-- mapping:start -->\n');
  const after = rest.split('<!-- mapping:end -->')[1];
  await writeFile(
    url,
    `${before}<!-- mapping:start -->\n\n${await fluentMappingTable()}\n<!-- mapping:end -->${after}`
  );
}
