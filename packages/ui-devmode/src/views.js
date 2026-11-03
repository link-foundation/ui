/**
 * The views of the inspector tabs, built with DOM APIs into the tab panels
 * of the layout: the outline (a WAI-ARIA tree), the property grid and the
 * read-only Styles, Tokens, Animations and Source views. Values reach the
 * DOM as text only.
 */

import { createEditor } from './editors.js';
import { flattenOutline } from './model.js';

const el = (doc, tag, attributes = {}, textContent) => {
  const node = doc.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    node.setAttribute(name, value);
  }
  if (textContent !== undefined) {
    node.textContent = textContent;
  }
  return node;
};

const note = (doc, text) => el(doc, 'p', { class: 'note' }, text);

/**
 * The outline: a WAI-ARIA tree of the document, one treeitem per element
 * (`id` and kind), selection following the focus.
 * @param {HTMLElement} panel
 * @param {import('./model.js').OutlineNode[]} outline
 * @param {{ t: Function, onSelect: (id: string) => void }} options
 * @returns {{ select: (id: string|null) => void }}
 */
export function renderOutline(panel, outline, { t, onSelect }) {
  const doc = panel.ownerDocument;
  panel.replaceChildren();
  const tree = el(doc, 'ul', { role: 'tree', 'aria-label': t('outline.label') });
  const items = new Map();
  const build = (node, level, into) => {
    const item = el(doc, 'li', {
      role: 'treeitem',
      'aria-level': String(level),
      'aria-selected': 'false',
      tabindex: '-1',
      'data-id': node.id,
    });
    const row = el(doc, 'span', { class: 'row' });
    const toggle = el(doc, 'span', { class: 'toggle', 'aria-hidden': 'true' });
    row.append(
      toggle,
      el(doc, 'span', { class: 'id' }, node.id),
      el(doc, 'span', { class: 'kind' }, node.type)
    );
    item.append(row);
    if (node.children.length > 0) {
      item.setAttribute('aria-expanded', 'true');
      toggle.textContent = '▾';
      const group = el(doc, 'ul', { role: 'group' });
      node.children.forEach((child) => build(child, level + 1, group));
      item.append(group);
    }
    items.set(node.id, item);
    into.append(item);
  };
  outline.forEach((node) => build(node, 1, tree));
  panel.append(tree);
  const first = tree.querySelector('[role="treeitem"]');
  if (first) {
    first.tabIndex = 0;
  }

  const visible = () =>
    flattenOutline(outline)
      .map(({ node }) => items.get(node.id))
      .filter((item) => !item.parentElement.closest('[aria-expanded="false"]'));
  const setExpanded = (item, expanded) => {
    item.setAttribute('aria-expanded', String(expanded));
    item.querySelector('.toggle').textContent = expanded ? '▾' : '▸';
    item.querySelector('[role="group"]').hidden = !expanded;
  };
  const focusItem = (item) => {
    onSelect(item.dataset.id);
    item.focus();
  };
  tree.addEventListener('click', (event) => {
    const item = event.target.closest('[role="treeitem"]');
    if (!item) {
      return;
    }
    if (event.target.closest('.toggle') && item.hasAttribute('aria-expanded')) {
      setExpanded(item, item.getAttribute('aria-expanded') !== 'true');
    }
    focusItem(item);
  });
  tree.addEventListener('keydown', (event) => {
    const item = event.target.closest('[role="treeitem"]');
    const list = visible();
    const at = list.indexOf(item);
    if (at < 0) {
      return;
    }
    const expandable = item.hasAttribute('aria-expanded');
    const expanded = item.getAttribute('aria-expanded') === 'true';
    const parent = item.parentElement.closest('[role="treeitem"]');
    const moves = {
      ArrowDown: () => list[at + 1],
      ArrowUp: () => list[at - 1],
      Home: () => list[0],
      End: () => list.at(-1),
      ArrowRight: () =>
        expandable && !expanded
          ? setExpanded(item, true)
          : expanded
            ? list[at + 1]
            : undefined,
      ArrowLeft: () =>
        expandable && expanded ? setExpanded(item, false) : parent,
    };
    if (!(event.key in moves)) {
      return;
    }
    event.preventDefault();
    const next = moves[event.key]();
    if (next) {
      focusItem(next);
    }
  });

  return {
    select(id) {
      for (const [itemId, item] of items) {
        const on = itemId === id;
        item.setAttribute('aria-selected', String(on));
        item.tabIndex = on ? 0 : -1;
      }
      if (!items.has(id) && first) {
        first.tabIndex = 0;
      }
    },
  };
}

/**
 * The property grid of one element: `name | editor | resolved value |
 * source layer | reset`. Rows whose value comes from `user` or `session`
 * have the class `is-changed`.
 * @param {HTMLElement} panel
 * @param {{ id: string, rows: import('./model.js').PropertyRow[],
 *   locked: boolean, writable: boolean, tokenPaths: readonly string[] }} data
 * @param {{ t: Function, onEdit: (row: object, value: unknown) => string|null,
 *   onReset: (row: object) => void }} options
 * @returns {{ update: (rows: import('./model.js').PropertyRow[]) => void }}
 */
export function renderProperties(panel, data, { t, onEdit, onReset }) {
  const doc = panel.ownerDocument;
  panel.replaceChildren();
  if (data.locked) {
    panel.append(note(doc, t('properties.locked', { id: data.id })));
  } else if (!data.writable) {
    panel.append(note(doc, t('properties.readOnly')));
  }
  const table = el(doc, 'table', { 'data-element': data.id });
  table.append(el(doc, 'caption', {}, t('properties.caption', { id: data.id })));
  const head = el(doc, 'tr');
  for (const key of ['name', 'editor', 'value', 'layer', 'reset']) {
    head.append(el(doc, 'th', { scope: 'col' }, t(`properties.${key}`)));
  }
  table.append(el(doc, 'thead'));
  table.tHead.append(head);
  const body = el(doc, 'tbody');
  table.append(body);
  const cells = new Map();
  const rowKey = (row) => `${row.name}\u0000${row.key ?? ''}`;
  for (const row of data.rows) {
    const tr = el(doc, 'tr', { 'data-name': row.label });
    const editor = createEditor(doc, row, {
      t,
      tokenPaths: data.tokenPaths,
      onEdit: (value) => onEdit(row, value),
    });
    const resolved = el(doc, 'td', { class: 'resolved' });
    const layer = el(doc, 'span', { class: 'layer' });
    const reset = el(doc, 'button', {
      type: 'button',
      'aria-label': t('properties.resetLabel', { name: row.label }),
    }, t('properties.reset'));
    reset.addEventListener('click', () => onReset(row));
    const editorCell = el(doc, 'td');
    editorCell.append(editor.node);
    const layerCell = el(doc, 'td');
    layerCell.append(layer);
    const resetCell = el(doc, 'td');
    resetCell.append(reset);
    tr.append(el(doc, 'th', { scope: 'row' }, row.label));
    tr.append(editorCell, resolved, layerCell, resetCell);
    body.append(tr);
    cells.set(rowKey(row), { tr, editor, resolved, layer, reset });
  }
  panel.append(table);

  const update = (rows) => {
    for (const row of rows) {
      const cell = cells.get(rowKey(row));
      if (!cell) {
        continue;
      }
      cell.editor.update(row);
      cell.resolved.textContent = row.text === '' ? '—' : row.text;
      cell.layer.textContent = row.layer;
      cell.tr.dataset.layer = row.layer;
      cell.tr.classList.toggle('is-changed', row.changed);
      cell.tr.classList.toggle('is-locked', row.locked);
      cell.reset.disabled = !row.writable || !row.changed;
    }
  };
  update(data.rows);
  return { update };
}

/** The matching style rules of the element, base rule first. */
export function renderStyles(panel, { id, styles }, { t }) {
  const doc = panel.ownerDocument;
  panel.replaceChildren();
  if (styles.length === 0) {
    panel.append(note(doc, t('styles.none', { id })));
    return;
  }
  for (const style of styles) {
    const when = [...style.states, ...style.at];
    panel.append(
      el(
        doc,
        'h3',
        {},
        `${style.rule} (${when.length > 0 ? when.join(', ') : t('styles.base')})`
      )
    );
    const list = el(doc, 'dl');
    for (const decl of style.declarations) {
      list.append(el(doc, 'dt', {}, decl.property), el(doc, 'dd', {}, decl.text));
    }
    panel.append(list);
  }
}

/** The tokens the element uses: path, resolved value, layer, users. */
export function renderTokens(panel, { id, tokens }, { t }) {
  const doc = panel.ownerDocument;
  panel.replaceChildren();
  if (tokens.length === 0) {
    panel.append(note(doc, t('tokens.none', { id })));
    return;
  }
  const table = el(doc, 'table');
  table.append(el(doc, 'caption', {}, t('tokens.caption', { id })));
  const head = el(doc, 'tr');
  for (const key of ['token', 'value', 'layer', 'usedBy']) {
    head.append(el(doc, 'th', { scope: 'col' }, t(`tokens.${key}`)));
  }
  table.append(el(doc, 'thead'));
  table.tHead.append(head);
  const body = el(doc, 'tbody');
  for (const token of tokens) {
    const value = el(doc, 'td', { class: 'resolved' });
    if (token.css) {
      const swatch = el(doc, 'span', { class: 'swatch', 'aria-hidden': 'true' });
      swatch.style.background = token.css;
      value.append(swatch);
    }
    value.append(token.text);
    const tr = el(doc, 'tr', { 'data-token': token.path });
    tr.append(
      el(doc, 'th', { scope: 'row' }, token.path),
      value,
      el(doc, 'td', {}, token.layer),
      el(doc, 'td', {}, token.usedBy.join(', '))
    );
    body.append(tr);
  }
  table.append(body);
  panel.append(table);
}

/** The animations that target the element, read-only. */
export function renderAnimations(panel, { id, animations }, { t }) {
  const doc = panel.ownerDocument;
  panel.replaceChildren();
  if (animations.length === 0) {
    panel.append(note(doc, t('animations.none', { id })));
    return;
  }
  panel.append(note(doc, t('animations.readOnly')));
  for (const animation of animations) {
    panel.append(el(doc, 'h3', {}, animation.id));
    const list = el(doc, 'dl');
    for (const { name, text } of animation.properties) {
      list.append(el(doc, 'dt', {}, name), el(doc, 'dd', {}, text));
    }
    panel.append(list);
  }
}

/** The Links Notation source of the element, read-only. */
export function renderSource(panel, { id, source }, { t }) {
  const doc = panel.ownerDocument;
  panel.replaceChildren(
    el(doc, 'pre', { 'aria-label': t('source.label', { id }) }, source)
  );
}

/** The empty state of a view without a selection. */
export function renderEmpty(panel, { t }) {
  panel.replaceChildren(note(panel.ownerDocument, t('empty.selection')));
}
