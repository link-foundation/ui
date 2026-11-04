import { commentDocument, createComments } from './model.js';
import {
  createCommentView,
  renderObjects,
  renderTasks,
  renderMarks,
} from './view.js';
import { commentCommands } from './commands.js';
import { installCommentPicking } from './picking.js';
export {
  createComments,
  readComments,
  commentDocument,
  COMMENT_LIMITS,
} from './model.js';
export { lasso } from './geometry.js';

/** Mount reusable comments over a stable-ID tree and its rendered objects. */
export function mountComments(options) {
  const { root, tree, nodeFor, onClose } = options;
  const document = root.ownerDocument;
  const window = document.defaultView;
  const restoreFocus = document.activeElement;
  const t = (text) => options.messages?.[text] ?? text;
  const storageKey =
    options.storageKey ?? `ui-comments:${window.location.pathname}`;
  const getDocument = () => commentDocument(tree);
  const { model, storage, restoreError } = restoreModel(
    options,
    getDocument,
    window,
    storageKey
  );
  const view = createCommentView({
    document,
    container: options.container ?? document.body,
    t,
  });
  const cleanups = [];
  const listen = commentListeners(cleanups);
  const nodes = () =>
    [...getDocument().byId.values()]
      .map((node) => ({ ...node, node: nodeFor(node.id) }))
      .filter(({ node }) => node?.isConnected);
  let selected = new Set();
  let closed = false;
  const announce = (text) => {
    view.status.textContent = text;
  };
  const run = (callback) => {
    try {
      callback();
    } catch (error) {
      announce(error.message);
    }
  };
  const marks = () => renderMarks(view, nodes(), selected, model);
  const refresh = () => {
    const available = nodes();
    selected = new Set(
      [...selected].filter((id) => available.some((node) => node.id === id))
    );
    renderObjects(view, available, selected);
    for (const task of model.tasks()) {
      const card = [...view.tasks.children].find(
        (node) => node.dataset.task === task.id
      );
      const meta = card?.querySelector('.meta');
      if (meta) {
        meta.textContent = `${task.revision} · ${t(model.state(task.id))} · ${task.input}`;
      }
    }
    marks();
  };
  const select = (ids) => {
    selected = new Set(ids);
    refresh();
  };
  const selection = () => [...selected];
  function destroy() {
    if (closed) {
      return;
    }
    closed = true;
    actions.destroy();
    picking.destroy();
    cleanups.splice(0).forEach((cleanup) => cleanup());
    view.host.remove();
    if (restoreFocus?.isConnected) {
      restoreFocus.focus?.();
    }
    onClose?.();
  }
  const picking = installCommentPicking({
    window,
    root,
    view,
    nodes,
    select,
    selection,
    listen,
    close: destroy,
  });
  const saveError = (error) => {
    if (!closed) {
      announce(
        `${t('Comments remain available in this tab. Export LiNo to keep them.')} ${error.message}`
      );
    }
  };
  const persist = () => {
    renderTasks(view, model, run);
    refresh();
    try {
      Promise.resolve(storage?.setItem(storageKey, model.export())).then(() => {
        if (!closed) {
          announce(t('Comments saved.'));
        }
      }, saveError);
    } catch (error) {
      saveError(error);
    }
  };
  cleanups.push(model.subscribe(persist));
  const actions = commentCommands({
    window,
    view,
    model,
    picking,
    selection,
    select,
    destroy,
    announce,
    isClosed: () => closed,
  });
  listen(view.shadow, 'click', (event) => {
    const action = event.target.closest?.('[data-action]')?.dataset.action;
    if (action) {
      run(() => actions.commands[action]?.());
    }
  });
  listen(view.objects, 'change', () =>
    select(
      [...view.objects.querySelectorAll('input:checked')].map(
        (node) => node.dataset.target
      )
    )
  );
  listen(window, 'scroll', marks, true);
  listen(window, 'resize', marks);
  if (options.observe ?? tree.subscribe) {
    cleanups.push((options.observe ?? tree.subscribe)(refresh));
  }
  if (window.ResizeObserver) {
    const observer = new window.ResizeObserver(marks);
    observer.observe(root);
    cleanups.push(() => observer.disconnect());
  }
  renderTasks(view, model, run);
  refresh();
  if (restoreError) {
    announce(`${t('Saved comments could not be restored.')} ${restoreError}`);
  }
  view.pick.focus();
  return { host: view.host, model, tree, select, selection, refresh, destroy };
}

function restoreModel(options, getDocument, window, storageKey) {
  let storage = options.storage;
  let saved = options.text;
  let restoreError = '';
  try {
    if (storage === undefined) {
      storage = window.localStorage;
    }
    saved ??= storage?.getItem(storageKey);
  } catch (error) {
    restoreError = error.message;
  }
  let model;
  try {
    model = createComments({ getDocument, text: saved, trace: options.trace });
  } catch (error) {
    restoreError = error.message;
    model = createComments({ getDocument, trace: options.trace });
  }
  return { model, storage, restoreError };
}

function commentListeners(cleanups) {
  return (target, name, handler, capture = false) => {
    target.addEventListener(name, handler, capture);
    cleanups.push(() => target.removeEventListener(name, handler, capture));
  };
}
