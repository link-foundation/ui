/** A designer made from the framework's LiNo dock, layout and control renderers. */
import { parseOrThrow } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import { render } from '@link-foundation/ui-dom';
import { CONTROL_KIND_SPECS } from '@link-foundation/ui-components/controls';
import { createConfig, persistUserLayer } from '@link-foundation/ui-config';
import { defaultPolicy, parseDevModePolicy } from '@link-foundation/ui-devmode';
import { createCatalog, designerVocabulary } from './catalog.js';
import { createDocumentSession } from './sync.js';
import { createSelection } from './selection.js';
import { createOutline } from './panels.js';
import { mountCanvas } from './canvas.js';
import { createEditing } from './editing.js';
import { createActions, keyboard } from './actions.js';
import { element, listen } from './dom.js';
import { DESIGNER_LAYOUT } from './layout-text.js';

function browserStorage(window) {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}
function readSaved(storage, key) {
  try {
    return storage?.getItem(key);
  } catch {
    return null;
  }
}
function createContext(options) {
  const {
    root,
    documentText,
    storageKey = 'link-ui-designer',
    catalog = createCatalog(),
  } = options;
  const document = root.ownerDocument;
  const window = document.defaultView;
  const storage =
    options.storage === undefined ? browserStorage(window) : options.storage;
  const policy =
    typeof options.policy === 'string'
      ? parseDevModePolicy(options.policy)
      : (options.policy ?? defaultPolicy());
  if (!policy.enabled) {
    throw new Error('The site policy disables the designer');
  }
  let session;
  try {
    session = createDocumentSession(
      readSaved(storage, `${storageKey}.draft`) ?? documentText
    );
  } catch {
    session = createDocumentSession(documentText);
  }
  const context = {
    options,
    root,
    document,
    window,
    storage,
    storageKey,
    policy,
    session,
    store: session.store,
    catalog,
    selection: createSelection(),
    controller: new window.AbortController(),
    modeValue: 'design',
    snapThreshold: options.snapThreshold ?? 6,
  };
  context.mode = () => context.modeValue;
  return context;
}

function mountShell(context) {
  const { root, options, storage, storageKey } = context;
  const shellStore = createStore({
    document: parseOrThrow(options.layoutText ?? DESIGNER_LAYOUT, {
      vocabulary: designerVocabulary(),
    }),
  });
  const config = createConfig({ document: shellStore.toDocument() });
  const persistence = storage
    ? persistUserLayer(config, storage, `${storageKey}.user`)
    : null;
  const layoutStorage = {
    getItem: (key) => config.resolve(key, 'note')?.value?.[0] ?? null,
    setItem: (key, text) => config.set('user', key, 'note', [text]),
  };
  const shell = render(root, shellStore, {
    kinds: CONTROL_KIND_SPECS,
    setTitle: false,
    layout: { storage: layoutStorage },
    isAction: (name) => name === 'designer',
    onAction: (detail) => {
      if (detail.action[0] === 'designer') {
        void context.command(detail.action[1]);
      }
    },
  });
  root.classList.add('ui-designer');
  root.dataset.mode = 'design';
  return { shellStore, shell, persistence };
}

function mountPanels(context) {
  const { root, document, shell, session, storageKey, store, options } =
    context;
  const status = element(
    document,
    'output',
    { class: 'designer-status', role: 'status', 'aria-live': 'polite' },
    'Design mode'
  );
  const error = element(document, 'p', {
    class: 'designer-source-error',
    role: 'alert',
    id: `${storageKey}-error`,
  });
  const source = element(document, 'textarea', {
    'aria-label': 'LiNo source',
    spellcheck: false,
    'aria-describedby': error.id,
  });
  source.value = session.getText();
  const file = element(document, 'input', {
    type: 'file',
    accept: '.lino,text/plain',
    'aria-label': 'Open LiNo file',
    hidden: '',
  });
  const canvas = element(document, 'div', {
    class: 'designer-canvas',
    tabindex: 0,
    role: 'region',
    'aria-label': 'Design canvas',
  });
  shell.nodeFor('canvas').append(canvas);
  shell.nodeFor('source').append(source, error);
  root.append(status, file);
  const handle = render(canvas, store, {
    kinds: CONTROL_KIND_SPECS,
    setTitle: false,
    onAction: options.onAction,
  });
  return {
    status,
    error,
    source,
    file,
    canvas,
    handle,
    report: (message) => {
      status.textContent = message;
    },
  };
}

/**
 * @param {{root: HTMLElement, documentText: string, storage?: Storage|null,
 *   storageKey?: string, catalog?: Map<string, object>, policy?: object|string,
 *   layoutText?: string, snapThreshold?: number, onAction?: Function,
 *   trace?: (event: string, detail: object) => void}} options
 * @returns {{getText: () => string, undo: () => boolean, redo: () => boolean,
 *   destroy: () => void, store: object, select: (id: string) => void,
 *   setMode: (mode: 'design'|'run') => void, editSource: (text: string) => object}}
 */
export function mountDesigner(options) {
  const context = createContext(options);
  Object.assign(context, mountShell(context));
  Object.assign(context, mountPanels(context));
  Object.assign(context, createEditing(context));
  context.outline = createOutline(context.shell.nodeFor('outline'), context);
  context.canvasController = mountCanvas(context);
  createToolbox(context.shell.nodeFor('toolbox'), context);
  context.command = createActions(context);
  const {
    root,
    source,
    file,
    controller,
    session,
    storage,
    storageKey,
    report,
    refresh,
    editSource,
  } = context;
  const unsubscribe = session.subscribe(() => {
    try {
      storage?.setItem(`${storageKey}.draft`, session.getText());
    } catch (error) {
      report(`Draft could not be saved: ${error.message}`);
    }
    refresh();
  });
  listen(source, 'input', () => editSource(source.value), controller);
  listen(
    file,
    'change',
    async () => {
      const opened = file.files[0];
      if (opened) {
        const text = await opened.text();
        source.value = text;
        editSource(text);
        file.value = '';
      }
    },
    controller
  );
  listen(root, 'keydown', (event) => keyboard(event, context), controller);
  refresh();
  return {
    getText: session.getText,
    store: session.store,
    select: (id) => context.choose(id),
    setMode: context.setMode,
    editSource,
    undo: session.undo,
    redo: session.redo,
    destroy() {
      controller.abort();
      unsubscribe();
      context.canvasController.destroy();
      context.handle.destroy();
      context.shell.destroy();
      context.persistence?.stop();
      session.destroy();
      source.remove();
      context.status.remove();
      file.remove();
      root.classList.remove('ui-designer');
      delete root.dataset.mode;
    },
  };
}

function createToolbox(panel, context) {
  const { document, catalog, controller } = context;
  const list = element(document, 'div', {
    class: 'designer-toolbox',
    role: 'group',
    'aria-label': 'Components',
  });
  for (const entry of catalog.values()) {
    const button = element(
      document,
      'button',
      { type: 'button', 'data-component': entry.type },
      `${entry.icon} ${entry.name}`
    );
    listen(button, 'click', () => context.insert(entry.type), controller);
    list.append(button);
  }
  panel.append(list);
}
