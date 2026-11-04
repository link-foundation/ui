/** Shell buttons and shortcuts share the same document commands. */
import { mountComments } from '@link-foundation/ui-devmode/comments';
import { isEditableTarget } from '@link-foundation/ui-devmode';
import {
  moveElements,
  removeElements,
  duplicateElements,
  copyElements,
  pasteElements,
  selectedRoots,
} from './commands.js';
import { nudgeElements } from './geometry.js';
import { insertionParent } from './editing.js';
import { element, editable } from './dom.js';

export function createActions(context) {
  const {
    run,
    store,
    selection,
    session,
    refresh,
    window,
    root,
    document,
    source,
    file,
    report,
    catalog,
  } = context;
  let clipboard = '';
  const selectResult = (ids) => {
    if (ids) {
      selection.replace(ids);
      refresh();
    }
  };
  const commands = {
    comments() {
      if (context.comments) {
        return;
      }
      context.comments = mountComments({
        root: context.canvas,
        tree: store,
        nodeFor: (id) => context.handle.nodeFor(id),
        storage: context.storage,
        storageKey: `${context.storageKey}.comments`,
        trace: context.options.trace,
        onClose() {
          context.comments = null;
        },
      });
      context.comments.select([...selection.ids]);
    },
    mode: () => context.setMode(context.mode() === 'design' ? 'run' : 'design'),
    undo: () => session.undo(),
    redo: () => session.redo(),
    delete: () => run((s) => removeElements(s, selection.ids)),
    duplicate: () =>
      selectResult(run((s) => duplicateElements(s, selection.ids, catalog))),
    async copy() {
      clipboard = copyElements(store, selection.ids);
      try {
        await window.navigator.clipboard?.writeText(clipboard);
      } catch {
        report('Fragment copied inside the designer');
      }
    },
    async cut() {
      await commands.copy();
      commands.delete();
    },
    async paste() {
      let text = clipboard;
      try {
        text = (await window.navigator.clipboard?.readText()) || text;
      } catch {
        /* Internal clipboard remains usable. */
      }
      selectResult(
        run((s) =>
          pasteElements(s, {
            parentId: insertionParent(context),
            text,
            catalog,
          })
        )
      );
    },
    open: () => file.click(),
    save() {
      const url = window.URL.createObjectURL(
        new window.Blob([session.getText()], {
          type: 'text/plain;charset=utf-8',
        })
      );
      const link = element(document, 'a', {
        href: url,
        download: 'document.lino',
      });
      root.append(link);
      link.click();
      link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 0);
    },
    async 'copy-source'() {
      try {
        await window.navigator.clipboard.writeText(session.getText());
        report('Source copied');
      } catch {
        await source.ready;
        source.focus();
        report('Press Ctrl/Cmd+A, then Ctrl/Cmd+C to copy Source');
      }
    },
  };
  return async (name) => {
    try {
      await commands[name]?.();
    } catch (error) {
      report(error.message);
    }
  };
}

function reorder(event, context, roots) {
  const { store, run, catalog } = context;
  const first = roots[0];
  const parentId = store.parentOf(first);
  if (!roots.every((id) => store.parentOf(id) === parentId)) {
    return;
  }
  const siblings = parentId === null ? store.roots() : store.children(parentId);
  const index =
    event.key === 'ArrowUp'
      ? Math.max(0, store.indexOf(first) - 1)
      : Math.min(siblings.length, store.indexOf(roots.at(-1)) + 2);
  run((s) => moveElements(s, { ids: roots, parentId, index, catalog }));
}
const arrowDelta = (key, step) =>
  ({
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  })[key];

/** Outline arrows navigate; canvas arrows nudge; Alt+arrows reorder from either. */
export function keyboard(event, context) {
  if (
    context.source.contains(event.target) ||
    editable(event.target) ||
    isEditableTarget(event.target)
  ) {
    return;
  }
  const key = event.key.toLowerCase();
  const shortcuts = {
    z: event.shiftKey ? 'redo' : 'undo',
    d: 'duplicate',
    c: 'copy',
    x: 'cut',
    v: 'paste',
    s: 'save',
    o: 'open',
  };
  const name =
    event.ctrlKey || event.metaKey
      ? shortcuts[key]
      : ['delete', 'backspace'].includes(key)
        ? 'delete'
        : null;
  if (name) {
    event.preventDefault();
    void context.command(name);
    return;
  }
  const { selection, store, run, canvas } = context;
  const roots = selectedRoots(store, selection.ids);
  if (
    event.altKey &&
    ['ArrowUp', 'ArrowDown'].includes(event.key) &&
    roots.length
  ) {
    event.preventDefault();
    reorder(event, context, roots);
    return;
  }
  const delta = arrowDelta(event.key, event.shiftKey ? 10 : 1);
  if (canvas.contains(event.target) && delta) {
    event.preventDefault();
    run((s) => nudgeElements(s, roots, ...delta));
  }
}
