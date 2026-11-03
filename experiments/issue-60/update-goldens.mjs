import { URL } from 'node:url';
// Run deliberately when reviewing exporter changes; never runs as part of a test.
import { readFileSync, writeFileSync } from 'node:fs';
import { exportDocument } from '../../packages/ui-convert/src/index.js';
const root = new URL(
  '../../packages/ui-convert/tests/export/fixtures/',
  import.meta.url
);
for (const name of ['document', 'form', 'unsupported']) {
  const source = readFileSync(new URL(`${name}.lino`, root), 'utf8');
  for (const target of ['react', 'vue', 'swiftui', 'compose']) {
    for (const mode of ['react', 'vue'].includes(target)
      ? ['wrapper', 'eject']
      : ['wrapper']) {
      const result = await exportDocument(source, { target, mode });
      for (const file of result.files) {
        writeFileSync(
          new URL(
            `${name}.${target}.${mode}.${file.path.split('.').pop()}`,
            root
          ),
          file.contents
        );
      }
    }
  }
}
