/* global URL */
import { parseNested } from '@link-foundation/ui-core';

/** Read a package data file in browsers and Node without a build. */
export async function readThemeFile(path) {
  const url = new URL(`../../themes/${path}`, import.meta.url);
  if (url.protocol === 'file:') {
    return (await import('node:fs/promises')).readFile(url, 'utf8');
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cannot load theme data: ${response.status} ${path}`);
  }
  return response.text();
}
const raw = (link) => (link.values.length ? link.values.map(raw) : link.id);

/** @returns {Promise<Array<{component:string,kind:string|null,status:string,props:object[]}>>} */
export async function getMuiMapping() {
  return parseNested(await readThemeFile('material3/mui-mapping.lino')).map(
    (link) => {
      const [, component, ...fields] = raw(link);
      return {
        component,
        kind: fields.find((f) => f[0] === 'kind')?.[1] ?? null,
        status: fields.find((f) => f[0] === 'status')[1],
        props: fields
          .filter((f) => f[0] === 'prop')
          .map(([, name, value, target]) => ({
            name,
            value,
            target: { name: target[0], value: target[1] },
          })),
      };
    }
  );
}
