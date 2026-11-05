import { merge, diff } from '@link-foundation/ui-settings';
import { createSavedLooks } from './saved-looks.js';
import { refreshPanel } from './panel-refresh.js';
import { createRows, panelNodes } from './panel-rows.js';
import { createToolbar, createSharing } from './panel-actions.js';

let sequence = 0;

function initialValues(schema, options) {
  return merge(schema, options.target?.values() ?? options.values, undefined)
    .values;
}

/** Create a light-DOM settings-panel element. The optional target is a
 * ui-settings bindConfig binding (user or session), or the same interface.
 * @param {import('@link-foundation/ui-settings').SettingsSchema} schema
 * @param {object} [options]
 */
export function createSettingsPanel(schema, options = {}) {
  const doc = options.document ?? globalThis.document;
  const win = doc.defaultView;
  const id = `settings-${++sequence}`;
  const element = doc.createElement('settings-panel');
  const mode = options.mode ?? 'page';
  element.dataset.mode = mode;
  element.setAttribute('role', 'region');
  element.setAttribute('aria-label', options.label ?? 'Settings');
  let values = initialValues(schema, options);
  const tabs = { ...options.tabs };
  let level = options.level;
  let peeking = false;
  let opener;
  let destroyed = false;
  const { node, button } = panelNodes(doc, element);
  const heading = node('h2', options.label ?? 'Settings');
  heading.tabIndex = -1;
  const close = () => {
    endPeek();
    element.hidden = true;
    opener?.focus();
  };
  if (mode === 'drawer') {
    button('Close settings', close);
  }
  const search = node('input');
  search.type = 'search';
  search.placeholder = 'Search settings';
  search.setAttribute('aria-label', 'Search settings');
  search.addEventListener('input', () => refresh(false));
  const count = node('p');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  const context = {
    node,
    button,
    schema,
    options,
    win,
    commit,
    getValues: () => values,
    isPeeking: () => peeking,
  };
  const {
    presets,
    peek,
    endPeek,
    destroy: stopToolbar,
  } = createToolbar({
    ...context,
    setPeek(value) {
      peeking = value;
      refresh();
    },
  });
  const { rows, sections } = createRows({ ...context, setTab, id });
  const { changes, status, importText, exportText } = createSharing({
    ...context,
    isDestroyed: () => destroyed,
  });
  const saved = createSavedLooks(context);
  function setTab(section, tab) {
    tabs[section] = tab;
    refresh();
  }
  function refresh(updateControls = true) {
    refreshPanel(
      context,
      { rows, sections, search, count, presets, peek, changes },
      { values, peeking, tabs, level },
      updateControls
    );
  }
  function commit(changes) {
    if (destroyed || peeking) {
      return false;
    }
    let result = merge(schema, values, changes);
    if (!result.rejected.length && options.normalizeChanges) {
      result = merge(
        schema,
        values,
        options.normalizeChanges(result.values, changes)
      );
    }
    if (result.rejected.length) {
      status.textContent = `Invalid settings: ${result.rejected.join(', ')}`;
      return false;
    }
    if (options.target) {
      options.target.update(result.values);
      values = merge(schema, options.target.values(), undefined).values;
    } else {
      values = result.values;
    }
    refresh();
    options.onChange?.({ ...values }, diff(schema, values));
    return true;
  }
  const unsubscribe = options.target?.subscribe?.((next) => {
    values = merge(schema, next, undefined).values;
    refresh();
  });
  const escape = (event) => {
    if (event.key === 'Escape' && mode === 'drawer' && !element.hidden) {
      event.preventDefault();
      close();
    }
  };
  doc.addEventListener('keydown', escape);
  refresh();
  if (options.sharedHash) {
    saved.applyShared(options.sharedHash);
  }
  if (mode === 'drawer') {
    element.hidden = true;
  }
  return {
    element,
    values: () => globalThis.structuredClone(values),
    update: commit,
    importText,
    exportText,
    ...saved,
    setTab,
    setLevel(next) {
      level = next;
      refresh();
    },
    open(trigger = doc.activeElement) {
      opener = trigger;
      element.hidden = false;
      heading.focus();
    },
    close,
    destroy() {
      endPeek();
      destroyed = true;
      unsubscribe?.();
      stopToolbar();
      doc.removeEventListener('keydown', escape);
      for (const entry of rows.values()) {
        entry.control.destroy();
        entry.preview?.destroy?.();
      }
      element.remove();
    },
  };
}
