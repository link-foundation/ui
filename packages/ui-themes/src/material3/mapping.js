import { loadMapping, readThemeFile } from '../mapping.js';
export { readThemeFile } from '../mapping.js';

/** Preserve the MUI adapter's public target objects over the shared LiNo loader. */
export async function getMuiMapping() {
  return loadMapping(await readThemeFile('material3/mui-mapping.lino')).map(
    ({ component, kind, status, props }) => ({
      component,
      kind,
      status,
      props: props.map(({ name, value, target }) => ({
        name,
        value,
        target: { name: target[0], value: target[1] },
      })),
    })
  );
}
