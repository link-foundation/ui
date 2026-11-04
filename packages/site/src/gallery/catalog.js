/** The #34 catalog is authoritative; examples are shared files, never inline copies. */
import { readFile, readdir } from 'node:fs/promises';
import { parseCatalog } from '@link-foundation/ui-components/controls';

export async function loadCatalog({
  examplesDir = new globalThis.URL('../../content/examples/', import.meta.url),
} = {}) {
  const catalog = parseCatalog(
    await readFile(
      new globalThis.URL(
        '../../../ui-components/src/controls/catalog.lino',
        import.meta.url
      ),
      'utf8'
    )
  );
  return Promise.all(
    [...catalog].map(async ([kind, { title }]) => {
      const directory = new globalThis.URL(`${kind}/`, examplesDir);
      const files = (await readdir(directory))
        .filter((file) => file.endsWith('.lino'))
        .sort();
      if (!files.length) {
        throw new Error(`${kind}: missing gallery examples`);
      }
      return {
        kind,
        title,
        examples: await Promise.all(
          files.map(async (file) => ({
            id: `${kind}-${file.slice(0, -5)}`,
            file: `content/examples/${kind}/${file}`,
            text: await readFile(new globalThis.URL(file, directory), 'utf8'),
          }))
        ),
      };
    })
  );
}
