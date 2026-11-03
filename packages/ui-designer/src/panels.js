/** The inspector's outline model and typed property grid reused inside designer docks. */
import {
  buildOutline,
  flattenOutline,
  propertyRows,
  isLocked,
} from '@link-foundation/ui-devmode/model';
import { renderProperties } from '@link-foundation/ui-devmode/views';
import { createConfig } from '@link-foundation/ui-config';
import { designerVocabulary } from './catalog.js';
import { element } from './dom.js';
import { setProperty } from './commands.js';

export const outlineOrder = (store) =>
  flattenOutline(buildOutline(store)).map(({ node }) => node.id);

function horizontalNavigation(event, item, items, index, collapsed, update) {
  let next = null;
  if (event.key === 'ArrowRight') {
    if (collapsed.has(item?.dataset.id)) {
      collapsed.delete(item.dataset.id);
      update();
    } else {
      next = items[index + 1];
    }
  }
  if (event.key === 'ArrowLeft') {
    if (item?.getAttribute('aria-expanded') === 'true') {
      collapsed.add(item.dataset.id);
      update();
    } else {
      next = item?.parentElement.closest('[role=treeitem]');
    }
  }
  return next;
}

/** Tree items have roving focus, expansion, selection and range/toggle paths. */
export function createOutline(panel, context) {
  const { store, selection, choose, controller, document } = context;
  const collapsed = new Set();
  let focusId = null;
  const tree = element(document, 'ul', {
    role: 'tree',
    'aria-label': 'Document outline',
    'aria-multiselectable': true,
  });
  panel.append(tree);
  tree.addEventListener(
    'click',
    (event) => {
      const item = event.target.closest('[role=treeitem]');
      if (!item) {
        return;
      }
      if (event.target.closest('[data-expand]')) {
        if (collapsed.has(item.dataset.id)) {
          collapsed.delete(item.dataset.id);
        } else {
          collapsed.add(item.dataset.id);
        }
        update();
        return;
      }
      focusId = item.dataset.id;
      choose(focusId, event);
      [...tree.querySelectorAll('[role=treeitem]')]
        .find((n) => n.dataset.id === focusId)
        ?.focus();
    },
    { signal: controller.signal }
  );
  tree.addEventListener(
    'keydown',
    (event) => {
      if (event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      const item = event.target.closest('[role=treeitem]');
      const items = [...tree.querySelectorAll('[role=treeitem]')].filter(
        (n) => !n.closest('[hidden]')
      );
      const index = items.indexOf(item);
      let next = null;
      if (event.key === 'ArrowDown') {
        next = items[index + 1];
      }
      if (event.key === 'ArrowUp') {
        next = items[index - 1];
      }
      if (event.key === 'Home') {
        next = items[0];
      }
      if (event.key === 'End') {
        next = items.at(-1);
      }
      next =
        next ??
        horizontalNavigation(event, item, items, index, collapsed, update);
      if (event.key === ' ' || event.key === 'Enter') {
        choose(item.dataset.id, event);
      }
      if (next) {
        focusId = next.dataset.id;
        choose(focusId, event);
        [...tree.querySelectorAll('[role=treeitem]')]
          .find((n) => n.dataset.id === focusId)
          ?.focus();
      }
      if (
        [
          'ArrowDown',
          'ArrowUp',
          'ArrowRight',
          'ArrowLeft',
          'Home',
          'End',
          ' ',
          'Enter',
        ].includes(event.key)
      ) {
        event.preventDefault();
      }
    },
    { signal: controller.signal }
  );
  function update() {
    const active = tree.contains(document.activeElement)
      ? document.activeElement.dataset.id
      : null;
    tree.replaceChildren();
    const build = (node, into, level) => {
      const item = element(document, 'li', {
        role: 'treeitem',
        tabindex: -1,
        'aria-selected': selection.ids.has(node.id),
        'aria-level': level,
        'data-id': node.id,
      });
      const row = element(document, 'span', { class: 'outline-row' });
      if (node.children.length) {
        item.setAttribute('aria-expanded', String(!collapsed.has(node.id)));
        row.append(
          element(
            document,
            'span',
            { 'data-expand': '', 'aria-hidden': true },
            collapsed.has(node.id) ? '▸' : '▾'
          )
        );
      }
      row.append(element(document, 'span', {}, `${node.id}: ${node.type}`));
      item.append(row);
      if (node.children.length) {
        const group = element(document, 'ul', { role: 'group' });
        group.hidden = collapsed.has(node.id);
        node.children.forEach((child) => build(child, group, level + 1));
        item.append(group);
      }
      into.append(item);
    };
    buildOutline(store).forEach((node) => build(node, tree, 1));
    const items = [...tree.querySelectorAll('[role=treeitem]')];
    const focused =
      items.find((n) => n.dataset.id === (active ?? focusId)) ?? items[0];
    if (focused) {
      focused.tabIndex = 0;
      if (active) {
        focused.focus();
      }
    }
  }
  update();
  return { update, tree };
}

const PROPERTY_MESSAGES = {
  'properties.caption': 'Properties of {id}',
  'properties.name': 'Property',
  'properties.editor': 'Editor',
  'properties.value': 'Value',
  'properties.layer': 'Layer',
  'properties.reset': 'Reset',
  'properties.resetLabel': 'Reset {name}',
  'properties.unitLabel': '{name} unit',
  'properties.unset': 'Unset',
  'properties.locked': '{id} is locked',
  'properties.readOnly': 'Read only',
};
const t = (key, params = {}) =>
  Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, value),
    PROPERTY_MESSAGES[key] ?? key
  );

/** One field change is one transaction, even when input emits several keystrokes. */
export function updateProperties(panel, context) {
  const { store, selection, policy, run, report, document } = context;
  const id = [...selection.ids].at(-1);
  if (!id || !store.has(id)) {
    panel.replaceChildren(
      element(document, 'p', {}, 'Select an element to edit its properties.')
    );
    return;
  }
  const config = createConfig({ document: store.toDocument() });
  const rows = propertyRows(store.get(id), config, {
    policy,
    vocabulary: designerVocabulary(),
    parentOf: store.parentOf,
  });
  const pending = new Map();
  renderProperties(
    panel,
    {
      id,
      rows,
      locked: isLocked(policy, id, store.parentOf),
      writable: policy.writeLayers.length > 0,
      tokenPaths: [],
    },
    {
      t,
      onEdit(row, value) {
        pending.set(row.name, value);
        return null;
      },
      onReset(row) {
        run((s) => s.removeProp(id, row.name));
      },
    }
  );
  panel.onchange = () => {
    for (const [name, value] of pending) {
      try {
        run((s) => setProperty(s, id, name, value));
      } catch (error) {
        report(error.message);
      }
    }
    pending.clear();
  };
}
