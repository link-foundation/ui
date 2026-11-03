/** Multi-document source editor. Opening a document only edits text. */
import { defineKind } from '@link-foundation/ui-dom';
import { atomOf } from '../layout/dom.js';
import { createDocumentsModel } from './documents-model.js';
import { createEditorEngine } from './editor-engine.js';
import { createEditorUi } from './editor-ui.js';

let instances = 0;

/** Mount into any host; also used by the custom element. */
export function mountCodeEditor(
  host,
  {
    model = createDocumentsModel(),
    engine = 'codemirror',
    engineOptions,
    ...options
  } = {}
) {
  instances++;
  let adapter;
  let run = 0;
  let stopped = false;
  const ui = createEditorUi(host, model, {
    ...options,
    instance: instances,
    confirmClose:
      options.confirmClose ??
      (() =>
        host.ownerDocument.defaultView.confirm(
          'Unsaved changes. Close this document?'
        )),
    focus: (offset) => adapter?.focus(offset),
  });
  const display = async () => {
    const revision = ++run;
    const diagnostics = ui.render();
    if (!adapter) {
      return;
    }
    const active = model.active;
    if (active) {
      await adapter.setDocument(active);
    }
    if (stopped || revision !== run) {
      return;
    }
    adapter.setDiagnostics(diagnostics);
    host.dataset.ready = 'true';
  };
  const unsubscribe = model.subscribe(() => {
    void display();
  });
  const ready = createEditorEngine(engine, ui.area, {
    ...engineOptions,
    label: ui.label,
    onChange: (text, id) => {
      if (model.get(id)) {
        model.edit(id, text);
      }
    },
  })
    .then(async (loaded) => {
      if (stopped) {
        loaded.destroy();
        return;
      }
      adapter = loaded;
      await display();
    })
    .catch((error) => {
      if (!stopped) {
        host.dataset.ready = 'error';
        const message = host.ownerDocument.createElement('p');
        message.setAttribute('role', 'alert');
        message.textContent = `Unable to load editor: ${error.message}`;
        ui.area.append(message);
      }
      throw error;
    });
  // Escape arms a single native Tab escape, including Monaco's Tab handler.
  let escape = false;
  const keyboard = (event) => {
    if (!ui.area.contains(event.target)) {
      return;
    }
    if (event.key === 'Tab' && escape) {
      event.stopImmediatePropagation();
      escape = false;
    } else {
      escape = event.key === 'Escape';
    }
  };
  host.addEventListener('keydown', keyboard, true);
  void display();
  return {
    model,
    ready,
    focus: (offset) => adapter?.focus(offset),
    destroy() {
      stopped = true;
      run++;
      unsubscribe();
      adapter?.destroy();
      ui.destroy();
      model.destroy();
      host.removeEventListener('keydown', keyboard, true);
      delete host.dataset.ready;
    },
  };
}

/** Define once per window; import remains safe without a browser. */
export function defineCodeEditor(win = globalThis.window) {
  if (!win?.customElements || win.customElements.get('ui-code-editor')) {
    return;
  }
  class CodeEditor extends win.HTMLElement {
    constructor() {
      super();
      this.editorOptions = {};
      this._model = null;
      this._mounted = null;
    }
    get model() {
      this._model ??=
        this.editorOptions.model ?? createDocumentsModel(this.editorOptions);
      return this._model;
    }
    get ready() {
      return this._mounted?.ready ?? Promise.resolve();
    }
    openDocument(doc) {
      return this.model.open(doc);
    }
    externalUpdate(id, text) {
      return this.model.externalUpdate(id, text);
    }
    focusEditor(offset) {
      this._mounted?.focus(offset);
    }
    connectedCallback() {
      this._mounted ??= mountCodeEditor(this, {
        ...this.editorOptions,
        model: this.model,
        engine:
          this.getAttribute('engine') ??
          this.editorOptions.engine ??
          'codemirror',
      });
      // A visible error is rendered; keep the public ready promise rejectable.
      this.ready.catch(() => {});
    }
    disconnectedCallback() {
      this._mounted?.destroy();
      this._mounted = null;
    }
  }
  win.customElements.define('ui-code-editor', CodeEditor);
}

/** LiNo `(source: code-editor (label Source) (value '...'))` integration. */
export function registerEditor(target) {
  const spec = {
    tag: 'ui-code-editor',
    childrenSlot: null,
    create(el, ctx) {
      defineCodeEditor(ctx.document.defaultView);
      const node = ctx.document.createElement('ui-code-editor');
      node.editorOptions = ctx.options.editor ?? {};
      return node;
    },
    update(node, el) {
      const label = atomOf(el, 'label') ?? 'Source editor';
      node.setAttribute('label', label);
      node.setAttribute('engine', atomOf(el, 'engine') ?? 'codemirror');
      const id = atomOf(el, 'document-id') ?? el.id;
      const text = atomOf(el, 'value') ?? '';
      if (node.model?.get(id)) {
        node.externalUpdate(id, text);
      } else {
        node.openDocument?.({
          id,
          text,
          title: atomOf(el, 'title') ?? id,
          language: atomOf(el, 'language') ?? 'lino',
        });
      }
    },
    destroy(node) {
      node._mounted?.destroy();
      node._mounted = null;
    },
  };
  if (target instanceof Map) {
    target.set('code-editor', spec);
  } else if (target) {
    target['code-editor'] = spec;
  } else {
    defineKind('code-editor', spec);
  }
  return spec;
}
