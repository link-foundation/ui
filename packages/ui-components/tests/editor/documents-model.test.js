import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createDocumentsModel } from '../../src/editor/documents-model.js';

function setup() {
  const data = new Map();
  const storage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
  };
  const jobs = new Map();
  let tick = 0;
  const clock = {
    setTimeout(fn, ms) {
      assert.equal(ms, 500);
      jobs.set(++tick, fn);
      return tick;
    },
    clearTimeout: (id) => jobs.delete(id),
  };
  return {
    storage,
    clock,
    data,
    jobs,
    flush() {
      for (const [id, fn] of jobs) {
        jobs.delete(id);
        fn();
      }
    },
  };
}
describe('document-id editor drafts', () => {
  it('keeps drafts on switch, debounces at 500ms and restores tabs and active id', () => {
    const env = setup();
    const model = createDocumentsModel(env);
    model.open({ id: 'a', text: 'one' });
    model.open({ id: 'b', text: 'two' });
    model.edit('a', 'draft A');
    model.edit('a', 'draft A2');
    model.edit('b', 'draft B');
    assert.equal(env.jobs.size, 2);
    model.switch('a');
    assert.equal(model.active.text, 'draft A2');
    env.flush();
    const restored = createDocumentsModel(env);
    assert.equal(restored.active.id, 'a');
    assert.equal(restored.get('a').text, 'draft A2');
    assert.equal(restored.get('b').text, 'draft B');
    assert.equal(restored.get('a').dirty, true);
  });
  it('saves the empty string and requires confirmation before dirty close', () => {
    const env = setup();
    const model = createDocumentsModel(env);
    model.open({ id: 'a', text: 'one' });
    model.edit('a', '');
    assert.equal(model.close('a'), 'unsaved');
    assert.equal(model.get('a').text, '');
    model.save('a');
    const restored = createDocumentsModel(env);
    assert.equal(restored.get('a').text, '');
    assert.equal(restored.get('a').dirty, false);
    assert.equal(model.close('a'), 'closed');
  });
  it('protects dirty drafts until keep-mine or load-theirs, including empty external text', () => {
    const model = createDocumentsModel();
    model.open({ id: '__proto__', text: 'base' });
    model.edit('__proto__', 'mine');
    assert.equal(model.externalUpdate('__proto__', ''), 'conflict');
    assert.equal(model.active.text, 'mine');
    assert.throws(() => model.save('__proto__'), /conflict/u);
    model.resolve('__proto__', 'mine');
    assert.equal(model.active.text, 'mine');
    assert.equal(model.active.dirty, true);
    model.externalUpdate('__proto__', 'theirs');
    model.resolve('__proto__', 'theirs');
    assert.equal(model.active.text, 'theirs');
    assert.equal(model.active.dirty, false);
  });
  it('clears stale pending drafts on save, close and destroy', () => {
    const env = setup();
    const model = createDocumentsModel(env);
    model.open({ id: 'a', text: 'base' });
    model.edit('a', 'new');
    model.save('a');
    assert.equal(env.jobs.size, 0);
    model.edit('a', 'other');
    model.close('a', { discard: true });
    env.flush();
    assert.equal(createDocumentsModel(env).documents.length, 0);
    model.open({ id: 'b', text: 'base' });
    model.edit('b', 'draft');
    model.destroy();
    assert.equal(env.jobs.size, 0);
    assert.equal(createDocumentsModel(env).get('b').text, 'draft');
  });
});
