import { it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { parse } from '@link-foundation/ui-core';
import {
  defineCodeEditor,
  mountCodeEditor,
  registerEditor,
} from '../../src/editor/index.js';
import { createDocumentsModel } from '../../src/editor/documents-model.js';
import { createEditorEngine } from '../../src/editor/editor-engine.js';

it('exports the LiNo kind and declares its supported properties', () => {
  const kinds = new Map();
  registerEditor(kinds);
  assert.equal(kinds.get('code-editor').tag, 'ui-code-editor');
  const document = parse(
    "source: code-editor\n  label Source\n  document-id doc.lino\n  value 'app: document'\n  engine codemirror\n  language lino"
  );
  assert.deepEqual(document.diagnostics, []);
});
it('custom elements are per-window and document models are isolated without loading an engine', () => {
  const { window } = new JSDOM();
  defineCodeEditor(window);
  defineCodeEditor(window);
  const a = window.document.createElement('ui-code-editor');
  const b = window.document.createElement('ui-code-editor');
  a.openDocument({ id: 'one', text: 'mine' });
  assert.equal(a.model.active.text, 'mine');
  const model = createDocumentsModel();
  b.editorOptions = { model };
  assert.equal(b.model, model);
  assert.equal(b.model.active, null);
  window.close();
});
it('rejects unknown engines before loading any adapter', async () => {
  await assert.rejects(
    createEditorEngine('unknown', {}),
    /Unknown editor engine/u
  );
});
it('imperative mounting injects storage, key and clock into its default model', async () => {
  const { window } = new JSDOM();
  const data = new Map();
  const jobs = new Set();
  const storage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const mounted = mountCodeEditor(window.document.createElement('div'), {
    engine: 'unknown',
    storage,
    key: 'workspace',
    clock: {
      setTimeout(fn, ms) {
        assert.equal(ms, 500);
        jobs.add(fn);
        return fn;
      },
      clearTimeout: (fn) => jobs.delete(fn),
    },
  });
  try {
    await assert.rejects(mounted.ready, /Unknown editor engine/u);
    mounted.model.open({ id: 'source', text: 'base' });
    mounted.model.edit('source', 'draft');
    assert.equal(jobs.size, 1);
    for (const fn of jobs) {
      fn();
    }
    assert.equal(
      createDocumentsModel({ storage, key: 'workspace' }).active.text,
      'draft'
    );
    assert.equal(data.has('editor-tabs'), false);
  } finally {
    mounted.destroy();
    window.close();
  }
});
