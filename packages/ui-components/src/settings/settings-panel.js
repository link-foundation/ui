import {
  defaults,
  merge,
  diff,
  toLino,
  applyToRoot,
} from '@link-foundation/ui-settings';
import { buildPanelModel } from './panel-model.js';
import { createRows, panelNodes, refreshRows } from './panel-rows.js';
import { createToolbar, createSharing } from './panel-actions.js';

let sequence = 0;

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
  let values = merge(
    schema,
    options.target?.values() ?? options.values,
    undefined
  ).values;
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
  const {
    presets,
    peek,
    endPeek,
    destroy: stopToolbar,
  } = createToolbar({
    node,
    button,
    schema,
    options,
    win,
    commit,
    getValues: () => values,
    isPeeking: () => peeking,
    setPeek(value) {
      peeking = value;
      refresh();
    },
  });
  const { rows, sections } = createRows({
    node,
    button,
    schema,
    id,
    commit,
    getValues: () => values,
    isPeeking: () => peeking,
  });
  const { changes, status } = createSharing({
    node,
    button,
    schema,
    options,
    win,
    commit,
    getValues: () => values,
    isDestroyed: () => destroyed,
  });

  function refresh(updateControls = true) {
    const shown = peeking ? defaults(schema) : values;
    const model = buildPanelModel(schema, values, { query: search.value });
    refreshRows(schema, {
      rows,
      sections,
      model,
      values,
      shown,
      peeking,
      updateControls,
    });
    count.textContent = `${model.changedCount} changed settings`;
    presets.value = model.activePreset ?? '';
    peek.setAttribute('aria-pressed', String(peeking));
    changes.value = toLino(schema, values);
    if (options.previewRoot) {
      applyToRoot(schema, shown, options.previewRoot);
    }
  }
  function commit(changes) {
    if (destroyed || peeking) {
      return;
    }
    const result = merge(schema, values, changes);
    if (result.rejected.length) {
      status.textContent = `Invalid settings: ${result.rejected.join(', ')}`;
      return;
    }
    if (options.target) {
      options.target.update(result.values);
      values = merge(schema, options.target.values(), undefined).values;
    } else {
      values = result.values;
    }
    refresh();
    options.onChange?.({ ...values }, diff(schema, values));
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
  if (mode === 'drawer') {
    element.hidden = true;
  }
  return {
    element,
    values: () => globalThis.structuredClone(values),
    update: commit,
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
      }
      element.remove();
    },
  };
}
