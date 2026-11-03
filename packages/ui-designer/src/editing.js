/** Shared editing paths for canvas, properties, Source and keyboard commands. */
import { isLocked } from '@link-foundation/ui-devmode/model';
import { insertElement } from './commands.js';
import { outlineOrder, updateProperties } from './panels.js';

export function validatePolicy(context, ops) {
  const { store, policy } = context;
  for (const op of ops) {
    const affected = [op.id, op.parentId];
    if (['remove', 'move'].includes(op.op) && store.has(op.id)) {
      const descendants = (id) => {
        affected.push(id);
        store.children(id).forEach(descendants);
      };
      descendants(op.id);
    }
    for (const id of affected) {
      if (id && store.has(id) && isLocked(policy, id, store.parentOf)) {
        throw new Error(`${id} is locked`);
      }
    }
  }
}

export const insertionParent = (context) =>
  [...context.selection.ids].at(-1) ?? context.store.roots()[0] ?? null;

export function createEditing(context) {
  const {
    root,
    store,
    selection,
    session,
    policy,
    source,
    error,
    shellStore,
    shell,
    options,
    report,
  } = context;
  function refresh() {
    context.handle.flush();
    selection.retain(outlineOrder(store));
    context.outline.update();
    updateProperties(shell.nodeFor('properties'), context);
    context.canvasController?.update();
    shellStore.setProp('undo', 'disabled', [String(!store.canUndo())]);
    shellStore.setProp('redo', 'disabled', [String(!store.canRedo())]);
    if (
      source.getAttribute('aria-invalid') !== 'true' &&
      source.value !== session.getText()
    ) {
      source.value = session.getText();
    }
  }
  function choose(id, event = {}) {
    if (event.shiftKey && id) {
      selection.range(id, outlineOrder(store));
    } else if ((event.ctrlKey || event.metaKey) && id) {
      selection.toggle(id);
    } else {
      selection.select(id);
    }
    refresh();
  }
  function run(action) {
    if (!policy.writeLayers.length || context.mode() !== 'design') {
      report('Editing is disabled');
      return null;
    }
    try {
      const result = session.run(action, 'Canvas edit', (ops) =>
        validatePolicy(context, ops)
      );
      options.trace?.('canvas-commit', { tx: store.log().at(-1)?.tx });
      report('Changes saved to draft');
      return result;
    } catch (error) {
      report(error.message);
      options.trace?.('edit-refused', { message: error.message });
      return null;
    }
  }
  function insert(type) {
    const ids = run((s) =>
      insertElement(s, {
        parentId: insertionParent(context),
        type,
        catalog: context.catalog,
      })
    );
    if (ids) {
      selection.replace(ids);
      refresh();
    }
  }
  function setMode(mode) {
    if (!['design', 'run'].includes(mode)) {
      throw new Error('Unknown designer mode');
    }
    context.modeValue = mode;
    root.dataset.mode = mode;
    source.readOnly = mode === 'run';
    shellStore.setProp('mode', 'label', [mode === 'design' ? 'Run' : 'Design']);
    context.canvasController.update();
    report(`${mode === 'design' ? 'Design' : 'Run'} mode`);
  }
  function editSource(text) {
    const result =
      !policy.writeLayers.length || context.mode() !== 'design'
        ? { error: { line: 1, column: 1, message: 'Editing is disabled' } }
        : session.editSource(text, (ops) => validatePolicy(context, ops));
    source.setAttribute('aria-invalid', String(!!result.error));
    error.textContent = result.error
      ? `Line ${result.error.line}, column ${result.error.column}: ${result.error.message}`
      : '';
    if (result.error) {
      options.trace?.('source-error', result.error);
    } else {
      source.value = session.getText();
    }
    return result;
  }
  return { refresh, choose, run, insert, setMode, editSource };
}
