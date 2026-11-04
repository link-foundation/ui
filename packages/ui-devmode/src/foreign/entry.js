import { openSession } from '../session.js';
import { defaultPolicy } from '../policy.js';
import { translator } from '../messages.js';
import { createForeignAdapter } from './adapter.js';
import {
  loadOverrides,
  saveOverrides,
  localStorageAdapter,
  chromeStorageAdapter,
  commentStorage,
} from './persist.js';

/** Open/toggle the same inspector over a foreign page. No page globals in extension world. */
export async function mountForeignDevMode({
  window = globalThis.window,
  storage,
  layout,
} = {}) {
  if (window.linkUiForeignDevMode) {
    await window.linkUiForeignDevMode.toggle();
    return window.linkUiForeignDevMode;
  }
  const document = window.document;
  const host = document.createElement('ui-foreign-devmode');
  host.style.cssText =
    'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });
  const ignore = (node) =>
    node === host || shadow.contains(node) || node.getRootNode?.() === shadow;
  storage ??= globalThis.chrome?.storage?.local
    ? chromeStorageAdapter(globalThis.chrome.storage.local)
    : localStorageAdapter({
        getItem: (key) => window.localStorage.getItem(key),
        setItem: (key, value) => window.localStorage.setItem(key, value),
      });
  const comments = await commentStorage(storage, window.location);
  const adapter = createForeignAdapter({ root: document.body, ignore });
  let session;
  let opening;
  let destroyed = false;
  let pendingSave = Promise.resolve();
  let storageError = null;
  let restoreError = null;
  try {
    adapter.restore(await loadOverrides(storage, window.location));
  } catch (error) {
    restoreError = error.message;
  }
  const save = () => {
    const text = adapter.exportOverrides().text;
    pendingSave = pendingSave
      .catch(() => {})
      .then(() => saveOverrides(storage, window.location, text))
      .catch((error) => {
        storageError = error.message;
      });
  };
  const unsubscribe = adapter.observe(save);
  const controller = {
    adapter,
    host,
    get isOpen() {
      return Boolean(session);
    },
    get storageError() {
      return storageError ?? comments.storageError;
    },
    get restoreError() {
      return restoreError ?? comments.restoreError;
    },
    whenSaved: () =>
      Promise.all([pendingSave, comments.whenSaved()]).then(() => {}),
    async open() {
      if (destroyed) {
        return false;
      }
      if (session) {
        return true;
      }
      if (opening) {
        return await opening;
      }
      opening = (async () => {
        document.body.append(host);
        session = await openSession({
          window,
          root: document.body,
          config: adapter.config,
          adapter,
          container: shadow,
          layout,
          commentOptions: { storage: comments },
          policy: defaultPolicy(),
          t: translator(),
          onInspector(inspector) {
            inspector.host.style.pointerEvents = 'auto';
            const toolbar =
              inspector.shadow.querySelector('ui-devmode-toolbar');
            for (const [label, getText] of [
              ['Copy overrides as LiNo', () => adapter.exportOverrides().text],
              [
                'Copy subtree as LiNo',
                () => adapter.subtree(session?.getSelection()?.id),
              ],
            ]) {
              const button = document.createElement('button');
              button.type = 'button';
              button.textContent = label;
              button.addEventListener('click', () => {
                try {
                  copyExport(window, getText(), inspector);
                } catch (error) {
                  inspector.announce(error.message);
                }
              });
              toolbar.append(button);
            }
          },
          onClose() {
            session = null;
            host.remove();
          },
        });
        return true;
      })().finally(() => {
        opening = null;
      });
      return await opening;
    },
    close() {
      session?.close();
    },
    async toggle() {
      if (session) {
        controller.close();
        return false;
      }
      return await controller.open();
    },
    select: (id) => session?.select(id),
    getSelection: () => session?.getSelection() ?? null,
    setProperty: (id, name, value) => adapter.applyProperty(id, name, value),
    exportOverrides: () => adapter.exportOverrides(),
    exportSubtree: (id = session?.getSelection()?.id) => adapter.subtree(id),
    async destroy() {
      destroyed = true;
      controller.close();
      unsubscribe();
      adapter.destroy();
      await controller.whenSaved();
      delete window.linkUiForeignDevMode;
    },
  };
  window.linkUiForeignDevMode = controller;
  await controller.open();
  return controller;
}

async function copyExport(window, text, inspector) {
  const document = window.document;
  try {
    await window.navigator.clipboard.writeText(text);
    inspector.announce('Copied');
  } catch {
    const area = document.createElement('textarea');
    area.setAttribute('aria-label', 'LiNo export');
    area.value = text;
    inspector.panel('source').append(area);
    inspector.showView('source');
    area.focus();
    area.select();
  }
}
