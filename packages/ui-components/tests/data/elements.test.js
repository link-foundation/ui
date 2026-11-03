import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { mountBehavior } from '../../src/behavior/dom.js';
import { createDataSource, dataVocabulary } from '../../src/data/index.js';

function mount(text, sources = {}, data = {}) {
  const dom = new JSDOM('<!doctype html><div id="app"></div>', {
    pretendToBeVisual: true,
  });
  const diagnostics = [];
  const actions = [];
  const app = dom.window.document.getElementById('app');
  const mounted = mountBehavior(app, text, {
    parseOptions: { vocabulary: dataVocabulary() },
    data: { sources, ...data },
    onDiagnostic: (d) => diagnostics.push(d),
    host: { emit: (_event, args) => actions.push(args) },
  });
  const press = (node, key, modifiers = {}) =>
    node.dispatchEvent(
      new dom.window.KeyboardEvent('keydown', {
        key,
        bubbles: true,
        cancelable: true,
        ...modifiers,
      })
    );
  return {
    ...mounted,
    app,
    diagnostics,
    actions,
    press,
    close() {
      mounted.destroy();
      dom.window.close();
    },
  };
}
const items = [
  { id: 'a', label: 'Alpha', age: 2 },
  { id: 'b', label: 'Beta', age: 1 },
  { id: 'c', label: 'Charlie', age: 2 },
];

test('LiNo binding, template, selection/activation registry and source updates', () => {
  const source = createDataSource(items);
  const view = mount(
    `rows: list
  label Rows
  items
    param rows
  template row
  selection multi
  on select
    emit selected
      param item.id
  on activate
    emit activated
      param item.label
`,
    { rows: source },
    { templates: { row: (item) => `${item.label}!` } }
  );
  try {
    assert.deepEqual(view.diagnostics, []);
    const first = view.app.querySelector('[role=option]');
    assert.equal(first.textContent, 'Alpha!');
    first.click();
    view.press(first, 'ArrowDown', { shiftKey: true });
    assert.equal(view.app.querySelectorAll('[aria-selected=true]').length, 2);
    view.press(view.app.querySelector('[data-key=b]'), 'Enter');
    assert.deepEqual(view.actions.at(-1), ['Beta']);
    source.set([{ id: 'x', label: 'Extra' }, ...items]);
    assert.equal(
      view.app.querySelector('[data-key=b]'),
      view.app.ownerDocument.activeElement
    );
    assert.equal(first.getAttribute('aria-setsize'), '4');
  } finally {
    view.close();
  }
});

test('nested inline items are official parser values', () => {
  const view = mount(`rows: list
  label Rows
  items
    (id a) (label Alpha)
    (id b) (label Beta)
`);
  try {
    assert.deepEqual(view.diagnostics, []);
    assert.equal(view.app.querySelectorAll('[role=option]').length, 2);
  } finally {
    view.close();
  }
});

test('tree: expand, child, parent, collapse, typeahead and sibling metadata', () => {
  const view = mount(
    `outline: tree
  label Outline
  items
    param nodes`,
    {
      nodes: [
        {
          id: 'a',
          label: 'Alpha',
          children: [
            {
              id: 'b',
              label: 'Beta',
              children: [{ id: 'c', label: 'Charlie' }],
            },
          ],
        },
        { id: 'z', label: 'Zulu' },
      ],
    }
  );
  try {
    const first = view.app.querySelector('[data-key=a]');
    first.focus();
    view.press(first, 'ArrowRight');
    assert.equal(first.getAttribute('aria-expanded'), 'true');
    view.press(first, 'ArrowRight');
    const child = view.app.querySelector('[data-key=b]');
    assert.equal(child, view.app.ownerDocument.activeElement);
    assert.equal(child.getAttribute('aria-level'), '2');
    assert.equal(child.getAttribute('aria-setsize'), '1');
    view.press(child, 'ArrowLeft');
    assert.equal(first, view.app.ownerDocument.activeElement);
    view.press(first, 'ArrowLeft');
    assert.equal(view.app.querySelector('[data-key=b]'), null);
    view.press(first, 'z');
    assert.equal(view.app.ownerDocument.activeElement.dataset.key, 'z');
  } finally {
    view.close();
  }
});

test('lazy children load once, announce errors, and cancel on destruction', async () => {
  let resolve;
  let signal;
  let calls = 0;
  const view = mount(
    `outline: tree
  label Outline
  items
    param nodes`,
    { nodes: [{ id: 'a', label: 'Alpha', hasChildren: true }] },
    {
      loadChildren: (_item, context) => {
        calls++;
        signal = context.signal;
        return new Promise((r) => {
          resolve = r;
        });
      },
    }
  );
  const first = view.app.querySelector('[data-key=a]');
  view.press(first, 'ArrowRight');
  assert.equal(first.getAttribute('aria-busy'), 'true');
  resolve([{ id: 'b', label: 'Beta' }]);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(
    view.app.querySelector('[data-key=b]').getAttribute('aria-level'),
    '2'
  );
  assert.equal(calls, 1);
  assert.equal(signal.aborted, false);
  view.close();
  const failure = mount(
    `outline: tree
  items
    param nodes`,
    {
      nodes: [{ id: 'a', label: 'Alpha', hasChildren: true }],
    }
  );
  failure.press(failure.app.querySelector('[data-key=a]'), 'ArrowRight');
  await Promise.resolve();
  assert.match(
    failure.app.querySelector('[role=status]').textContent,
    /No loadChildren/
  );
  failure.close();
});

test('table columns, stable sorting, grid navigation and keyboard resize', () => {
  const view = mount(
    `people: table
  caption People
  items
    param people
  selection multi
  columns
    name: column
      label Name
      sortable true
    age: column
      label Age
      sortable true
`,
    { people: items.map((item) => ({ ...item, name: item.label })) }
  );
  try {
    assert.deepEqual(view.diagnostics, []);
    const headers = view.app.querySelectorAll('[role=columnheader]');
    assert.equal(headers.length, 2);
    headers[1].firstChild.click();
    assert.equal(headers[1].getAttribute('aria-sort'), 'ascending');
    assert.equal(
      view.app.querySelector('[role=row][data-key]').dataset.key,
      'b'
    );
    headers[1].firstChild.click();
    assert.deepEqual(
      [...view.app.querySelectorAll('[role=row][data-key]')].map(
        (x) => x.dataset.key
      ),
      ['a', 'c', 'b']
    );
    const cell = view.app.querySelector('[data-key=a] [role=gridcell]');
    cell.focus();
    view.press(cell, 'ArrowRight');
    assert.equal(view.app.ownerDocument.activeElement.dataset.cell, '1');
    const resize = headers[0].lastChild;
    view.press(resize, 'ArrowRight');
    assert.equal(resize.getAttribute('aria-valuenow'), '170');
  } finally {
    view.close();
  }
});

for (const kind of ['list', 'tree', 'table']) {
  test(`${kind} empty, loading and error states`, () => {
    const view = mount(`data: ${kind}\n  label Data`);
    try {
      assert.equal(
        view.app.querySelector('[role=status]').textContent,
        'No items'
      );
      view.store.setProp('data', 'loading', ['true']);
      view.handle.flush();
      assert.equal(
        view.app.querySelector('[role=status]').textContent,
        'Loading…'
      );
      view.store.setProp('data', 'loading', ['false']);
      view.handle.flush();
      view.store.setProp('data', 'error', ['Unavailable']);
      view.handle.flush();
      assert.equal(
        view.app.querySelector('[role=status]').textContent,
        'Error: Unavailable'
      );
    } finally {
      view.close();
    }
  });
}

test('virtualized false renders the full collection and destruction aborts lazy work', async () => {
  const full = mount(
    `rows: list
  items
    param rows
  virtualized false`,
    {
      rows: Array.from({ length: 250 }, (_, i) => ({ id: String(i) })),
    }
  );
  assert.equal(full.app.querySelectorAll('[role=option]').length, 250);
  full.close();
  let signal;
  let finish;
  const lazy = mount(
    `outline: tree
  items
    param nodes`,
    {
      nodes: [{ id: 'root', hasChildren: true }],
    },
    {
      loadChildren: (_item, context) => {
        signal = context.signal;
        return new Promise((resolve) => {
          finish = resolve;
        });
      },
    }
  );
  lazy.press(lazy.app.querySelector('[data-key=root]'), 'ArrowRight');
  lazy.close();
  assert.equal(signal.aborted, true);
  finish([{ id: 'late' }]);
  await Promise.resolve();
  assert.equal(lazy.app.children.length, 0);
});
