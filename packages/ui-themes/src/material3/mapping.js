/* global URL */
import { readMapping } from '../mapping.js';

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
/** Preserve the public MUI row shape over the shared mapping loader. */
export async function getMuiMapping() {
  return readMapping(await readThemeFile('material3/mui-mapping.lino')).map(
    ({ name, kind, status, props }) => ({
      component: name,
      kind,
      status,
      props: props.map(({ property, value, target }) => ({
        name: property,
        value,
        target: { name: target[0], value: target[1] },
      })),
    })
  );
}
