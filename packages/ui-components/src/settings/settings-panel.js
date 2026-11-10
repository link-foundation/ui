import { merge, diff, countCustomized } from '@link-foundation/ui-settings';
import { createSavedLooks } from './saved-looks.js';
import { refreshPanel } from './panel-refresh.js';
import { createRows, createPanelHeader } from './panel-rows.js';
import { createToolbar, createSharing } from './panel-actions.js';

import { createMessages } from './messages.js';

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
  const messages = createMessages(options.messages);
  const element = doc.createElement('settings-panel');
  const mode = options.mode ?? 'page';
  element.dataset.mode = mode;
  let values = initialValues(schema, options);
  const tabs = { ...options.tabs };
  let level = options.level;
  const sectionLevels = { ...options.sectionLevels };
  let peeking = false;
  let opener;
  let destroyed = false;
  const { node, button, heading, search, count } = createPanelHeader({
    doc,
    element,
    options,
    messages,
    close: () => close(),
    onSearch: () => refresh(false),
  });
  const close = () => {
    toolbar.endPeek();
    element.hidden = true;
    opener?.focus();
  };
  const context = {
    node,
    button,
    schema,
    options,
    messages,
    win,
    commit,
    getValues: () => values,
    isPeeking: () => peeking,
  };
  const toolbar = createToolbar({
    ...context,
    setPeek(value) {
      peeking = value;
      refresh();
    },
  });
  const { rows, sections, chromes } = createRows({
    ...context,
    setTab,
    setSectionLevel,
    id,
  });
  const { changes, status, importText, exportText, copy } = createSharing({
    ...context,
    isDestroyed: () => destroyed,
    importLooks: (text) => saved.importLooks(text),
  });
  const saved = createSavedLooks({ ...context, status, copy });
  function setTab(section, tab) {
    tabs[section] = tab;
    refresh();
  }
  function setSectionLevel(section, next) {
    sectionLevels[section] = next;
    refresh();
  }
  function refresh(updateControls = true) {
    refreshPanel(
      context,
      { rows, sections, chromes, search, count, ...toolbar, changes },
      { values, peeking, tabs, level, sectionLevels },
      updateControls
    );
    toolbar.updatePeek(peeking);
    options.onChangedCount?.(countCustomized(schema, values));
  }
  function commit(changes) {
    if (destroyed || peeking) {
      return false;
    }
    const result = normalizeCommit(schema, values, changes, options);
    if (result.rejected.length) {
      messages.content(status, 'rejected', { keys: result.rejected });
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
    setSectionLevel,
    changedCount: () => countCustomized(schema, values),
    setMessages(catalog) {
      messages.update(catalog);
      refresh();
    },
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
      toolbar.endPeek();
      destroyed = true;
      unsubscribe?.();
      toolbar.destroy();
      saved.destroyLooks();
      destroyControls(rows, chromes);
      doc.removeEventListener('keydown', escape);
      element.remove();
    },
  };
}

function normalizeCommit(schema, values, changes, options) {
  let result = merge(schema, values, changes);
  if (!result.rejected.length && options.normalizeChanges) {
    result = merge(
      schema,
      values,
      options.normalizeChanges(result.values, changes)
    );
  }
  return result;
}

function destroyControls(rows, chromes) {
  for (const chrome of chromes) {
    chrome.preview?.destroy?.();
    chrome.presets?.destroy();
  }
  for (const entry of rows.values()) {
    entry.control.destroy();
    entry.preview?.destroy?.();
  }
}
