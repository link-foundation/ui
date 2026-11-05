import {
  applySharedLook,
  diff,
  merge,
  fromShareHash,
} from '@link-foundation/ui-settings';

/** Named looks and a recoverable snapshot before the first shared link. */
export function createSavedLooks({
  schema,
  options,
  node,
  button,
  getValues,
  commit,
}) {
  const looks = new Map(Object.entries(options.savedLooks ?? {}));
  let beforeLink;
  const bar = node('div');
  bar.className = 'settings-toolbar';
  const name = node('input', undefined, bar);
  name.setAttribute('aria-label', 'Look name');
  const select = node('select', undefined, bar);
  select.setAttribute('aria-label', 'Saved looks');
  const refresh = () => {
    select.replaceChildren();
    for (const key of looks.keys()) {
      const option = node('option', key, select);
      option.value = key;
    }
  };
  const saveLook = (label) => {
    const key = String(label).trim();
    if (!key) {
      return;
    }
    looks.set(key, diff(schema, getValues()));
    options.onLooksChange?.(Object.fromEntries(looks));
    refresh();
  };
  const applyLook = (label) => {
    if (looks.has(label)) {
      commit(
        applySharedLook(
          schema,
          getValues(),
          merge(schema, undefined, looks.get(label)).values
        )
      );
    }
  };
  button('Save look', () => saveLook(name.value), bar);
  button('Apply saved look', () => applyLook(select.value), bar);
  button(
    'Delete saved look',
    () => {
      looks.delete(select.value);
      options.onLooksChange?.(Object.fromEntries(looks));
      refresh();
    },
    bar
  );
  const restore = button('Before the link', restoreBeforeLink, bar);
  restore.disabled = true;
  function restoreBeforeLink() {
    if (beforeLink) {
      commit(applySharedLook(schema, getValues(), beforeLink));
    }
  }
  function applyShared(hash) {
    const result = fromShareHash(schema, hash, getValues());
    if (result.ok) {
      const before = globalThis.structuredClone(getValues());
      if (!commit(result.values)) {
        return { ...result, ok: false };
      }
      beforeLink ??= before;
      restore.disabled = false;
    }
    return result;
  }
  refresh();
  return { saveLook, applyLook, applyShared, restoreBeforeLink };
}
