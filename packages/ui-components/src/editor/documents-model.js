/** Pure document state. Persistence is LiNo; storage and time are injected. */
import { createEditorPersistence } from './documents-persistence.js';

const defaultClock = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (id) => globalThis.clearTimeout(id),
};
const copy = (doc) => (doc ? { ...doc } : null);

/**
 * @param {{storage?: {getItem: Function, setItem: Function}, clock?: {setTimeout: Function, clearTimeout: Function}, key?: string}} [options]
 * Drafts live at `${key}:draft:${encodeURIComponent(id)}`. `editor-tabs` is
 * written immediately; each draft is written 500ms after its last edit.
 */
export function createDocumentsModel({
  storage,
  clock = defaultClock,
  key = 'editor-tabs',
} = {}) {
  const docs = new Map();
  const timers = new Map();
  const listeners = new Set();
  const persistence = createEditorPersistence(storage, key);
  let activeId = persistence.restore(docs);
  const persistTabs = () => persistence.saveTabs(docs, activeId);
  const cancel = (id) => {
    if (timers.has(id)) {
      clock.clearTimeout(timers.get(id));
      timers.delete(id);
    }
  };
  const persistDraft = (id) => {
    cancel(id);
    persistence.saveDraft(docs.get(id));
  };

  const notify = (type, id) => listeners.forEach((fn) => fn({ type, id }));
  const requireDoc = (id) => requireDocument(docs, id);
  const updateDirty = (doc) => {
    doc.dirty = doc.text !== doc.saved;
  };
  return {
    get documents() {
      return [...docs.values()].map(copy);
    },
    get active() {
      return copy(docs.get(activeId));
    },
    get: (id) => copy(docs.get(id)),
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    open({ id, text = '', title = id, language = 'lino' }) {
      if (typeof id !== 'string' || !id) {
        throw new TypeError('A document needs a nonempty string id');
      }
      if (!docs.has(id)) {
        docs.set(id, {
          id,
          text,
          title,
          language,
          saved: text,
          dirty: false,
          incoming: null,
        });
      }
      activeId = id;
      persistDraft(id);
      persistTabs();
      notify('open', id);
      return copy(docs.get(id));
    },
    switch(id) {
      requireDoc(id);
      activeId = id;
      persistTabs();
      notify('switch', id);
    },
    edit(id, text) {
      const doc = requireDoc(id);
      doc.text = text;
      updateDirty(doc);
      cancel(id);
      timers.set(
        id,
        clock.setTimeout(() => persistDraft(id), 500)
      );
      notify('edit', id);
    },
    save(id) {
      const doc = requireDoc(id);
      if (doc.incoming !== null) {
        throw new Error('Resolve the source conflict before saving');
      }
      doc.saved = doc.text;
      updateDirty(doc);
      persistDraft(id);
      persistTabs();
      notify('save', id);
      return doc.text;
    },
    close(id, { discard = false } = {}) {
      const doc = requireDoc(id);
      if ((doc.dirty || doc.incoming !== null) && !discard) {
        return 'unsaved';
      }
      cancel(id);
      docs.delete(id);
      if (activeId === id) {
        activeId = docs.keys().next().value ?? null;
      }
      persistTabs();
      notify('close', id);
      return 'closed';
    },
    externalUpdate(id, text) {
      const doc = requireDoc(id);
      if (text === doc.saved) {
        return 'unchanged';
      }
      if (doc.dirty || doc.incoming !== null) {
        doc.incoming = text;
        persistDraft(id);
        notify('conflict', id);
        return 'conflict';
      }
      doc.saved = text;
      doc.text = text;
      updateDirty(doc);
      persistDraft(id);
      persistTabs();
      notify('external', id);
      return 'updated';
    },
    resolve(id, choice) {
      const doc = requireDoc(id);
      if (!['mine', 'theirs'].includes(choice)) {
        throw new TypeError('Choose mine or theirs');
      }
      if (doc.incoming === null) {
        return;
      }
      doc.saved = doc.incoming;
      if (choice === 'theirs') {
        doc.text = doc.incoming;
      }
      doc.incoming = null;
      updateDirty(doc);
      persistDraft(id);
      persistTabs();
      notify('resolve', id);
    },
    destroy() {
      for (const id of timers.keys()) {
        persistDraft(id);
      }
      persistTabs();
      listeners.clear();
    },
  };
}

function requireDocument(docs, id) {
  if (!docs.has(id)) {
    throw new Error(`Unknown editor document: ${id}`);
  }
  return docs.get(id);
}
