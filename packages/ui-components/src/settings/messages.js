/** Host catalogs may use ui-i18n or any formatter; parameters stay structured. */
export const PANEL_MESSAGES = Object.freeze({
  settings: 'Settings',
  back: 'Back to my look',
  inherit: ({ label }) => `Inherit ${label}`,
  inherited: 'inherited',
  levels: ({ label }) => `${label} levels`,
  levelOwned: 'Own values',
  copyLooks: 'Copy all looks',
  emptyLooks: 'No saved looks yet',
  defaultLook: ({ count }) => `Look ${count}`,
  updateLook: 'Update to current',
  renameLook: 'Rename look',
  looksError:
    'Could not save or read looks. Check storage permissions or available space.',
  close: 'Close settings',
  search: 'Search settings',
  preset: 'Preset',
  custom: 'Custom',
  randomize: 'Randomize',
  resetAll: 'Reset everything',
  confirmReset: 'Reset every setting to its default?',
  peek: 'Peek defaults',
  changes: 'Your changes',
  copyText: 'Copy text',
  copied: 'Copied',
  copyFallback: 'Select and copy this text',
  copyChanges: 'Copy changes',
  pasteChanges: 'Paste changes',
  invalid: 'Invalid settings. No changes applied.',
  applied: 'Changes applied',
  import: 'Import settings',
  readError: 'Could not read settings',
  export: 'Export settings',
  share: 'Copy share link',
  shareError: 'Could not create share link',
  lookName: 'Look name',
  looks: 'Saved looks',
  saveLook: 'Save look',
  applyLook: 'Apply saved look',
  deleteLook: 'Delete saved look',
  beforeLink: 'Before the link',
  reset: ({ label }) => `Reset ${label}`,
  tabs: ({ label }) => `${label} tabs`,
  value: ({ label }) => `${label} value`,
  changed: 'Changed',
  count: ({ count }) => `${count} changed settings`,
  rejected: ({ keys }) => `Invalid settings: ${keys.join(', ')}`,
  increment: ({ label }) => `Increase ${label}`,
  decrement: ({ label }) => `Decrease ${label}`,
  palette: ({ label }) => `${label} palette`,
  rgb: ({ label }) => `${label} RGB`,
  red: ({ label }) => `${label} red`,
  green: ({ label }) => `${label} green`,
  blue: ({ label }) => `${label} blue`,
  number: ({ label }) => `${label} number`,
  remove: ({ label }) => `Remove ${label}`,
  add: ({ label }) => `Add ${label}`,
});

export function createMessages(catalog = {}) {
  let current = catalog;
  let revision = 0;
  const contents = new Map();
  const bindings = new Map();
  const text = (key, params = {}) => {
    const value = current[key] ?? PANEL_MESSAGES[key];
    return typeof value === 'function' ? value(params) : value;
  };
  const bind = (update, owner) => {
    bindings.set(update, owner);
    update();
  };
  return {
    text,
    get revision() {
      return revision;
    },
    content(element, key, params) {
      if (!contents.has(element)) {
        bind(() => {
          const item = contents.get(element);
          if (item) {
            element.textContent = text(...item);
          }
        }, element);
      }
      contents.set(element, [key, params]);
      element.textContent = text(key, params);
    },
    message: (key, params) => () => text(key, params),
    bind,
    attr(element, name, key, params) {
      bind(() => element.setAttribute(name, text(key, params)), element);
    },
    release(root) {
      for (const [update, owner] of bindings) {
        if (owner && root.contains(owner)) {
          bindings.delete(update);
          contents.delete(owner);
        }
      }
    },
    update(next) {
      current = next;
      revision++;
      for (const update of bindings.keys()) {
        update();
      }
    },
  };
}
