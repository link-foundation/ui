/**
 * Every text the dev mode UI shows, by key. A page passes its own table
 * (`mountDevMode({ messages })`) to translate dev mode; the
 * keys it leaves out fall back to these English texts.
 */

/** The English texts. `{name}` is replaced by the parameter `name`. */
export const MESSAGES = Object.freeze({
  'inspector.title': 'Dev mode',
  'inspector.label': 'Dev mode inspector',
  'resize.label': 'Resize the inspector',
  'toolbar.defaults': 'Make these the defaults',
  'defaults.title': 'Make these the defaults',
  'defaults.count': '{count} changes',
  'defaults.overrides': 'Overrides as LiNo',
  'defaults.share': 'Share link',
  'defaults.instruction': 'Agent instruction',
  'defaults.copy': 'Copy',
  'defaults.copyLabel': 'Copy {name}',
  'defaults.copied': 'Copied.',
  'defaults.select': 'Text selected. Copy it with your keyboard.',
  'defaults.tooLong':
    'Share link exceeds 8,192 characters. Copy the LiNo text instead.',
  'defaults.issue': 'Open as GitHub issue',
  'defaults.close': 'Close dialog',
  'shared.title': 'Shared UI changes are previewed.',
  'shared.keep': 'Keep',
  'shared.discard': 'Discard',
  'toolbar.label': 'Dev mode actions',
  'toolbar.pick': 'Pick element',
  'toolbar.save': 'Save',
  'toolbar.discard': 'Discard',
  'toolbar.close': 'Close',
  'tabs.label': 'Inspector views',
  'tab.outline': 'Outline',
  'tab.properties': 'Properties',
  'tab.styles': 'Styles',
  'tab.tokens': 'Tokens',
  'tab.animations': 'Animations',
  'tab.source': 'Source',
  'selection.none': 'No element selected',
  'selection.current': 'Selected: {id} ({type})',
  'selection.picking': 'Pick mode: click an element, Escape to stop',
  'empty.selection': 'Select an element in the page or in the outline.',
  'outline.label': 'Document outline',
  'properties.caption': 'Properties of {id}',
  'properties.name': 'Property',
  'properties.editor': 'Edit',
  'properties.value': 'Resolved value',
  'properties.layer': 'Layer',
  'properties.reset': 'Reset',
  'properties.resetLabel': 'Reset {name}',
  'properties.unitLabel': '{name} unit',
  'properties.unset': 'not set',
  'properties.locked': '{id} is locked by the site policy; it is read-only.',
  'properties.readOnly': 'The site policy lets dev mode write no layer.',
  'styles.none': 'No style rule matches {id}.',
  'styles.base': 'base',
  'tokens.caption': 'Tokens used by {id}',
  'tokens.none': '{id} uses no design token.',
  'tokens.token': 'Token',
  'tokens.value': 'Resolved value',
  'tokens.layer': 'Layer',
  'tokens.usedBy': 'Used by',
  'animations.none': 'No animation targets {id}.',
  'animations.readOnly': 'Animations are read-only here.',
  'source.label': 'Links Notation source of {id}',
  'status.saved': 'Saved {count} change(s) to the user layer.',
  'status.discarded': 'Discarded {count} session change(s).',
  'status.reset': 'Reset {name}: the {layer} value was removed.',
  'status.nothing': 'Nothing to reset for {name}.',
  'status.error': '{message}',
  'overlay.label': '{id}: {type}',
});

/**
 * A message with its parameters filled in.
 * @param {Readonly<Record<string, string>>} table
 * @param {string} key
 * @param {Record<string, string|number>} [params]
 * @returns {string}
 */
export function message(table, key, params = {}) {
  const text = table[key] ?? MESSAGES[key] ?? key;
  let out = '';
  let at = 0;
  while (at < text.length) {
    const open = text.indexOf('{', at);
    const close = open < 0 ? -1 : text.indexOf('}', open);
    if (close < 0) {
      out += text.slice(at);
      break;
    }
    const name = text.slice(open + 1, close);
    out +=
      text.slice(at, open) +
      (Object.hasOwn(params, name)
        ? String(params[name])
        : text.slice(open, close + 1));
    at = close + 1;
  }
  return out;
}

/**
 * A translator over a page's table: `t(key, params)`.
 * @param {Readonly<Record<string, string>>} [table]
 */
export const translator =
  (table = {}) =>
  (key, params) =>
    message(table, key, params);
