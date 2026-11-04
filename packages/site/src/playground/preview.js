/** Validated inspector changes update the preview store and preserve source text. */
import { format } from '@link-foundation/ui-core';
import { applyOpsToSource } from '@link-foundation/ui-core/source';
import { createStore } from '@link-foundation/ui-store';
import { createConfig } from '@link-foundation/ui-config';
import { render } from '@link-foundation/ui-dom';
import { mountDevMode } from '@link-foundation/ui-devmode';
import { siteVocabulary } from '../kinds.js';
import { validateDocument } from './validate.js';
export function createPreview({
  tree,
  preview,
  themes,
  theme,
  scheme,
  editor,
  showErrors,
  lineNumbers,
}) {
  preview.setAttribute('data-scheme', scheme);
  const store = createStore({ document: tree });
  const config = createConfig({ document: store.toDocument() });
  const handle = render(preview, store, {
    config,
    themes,
    theme,
    adoptStyles: false,
    isAction: (name) => name === 'log',
    onAction: () => {},
  });
  // Selection and edits are scoped to the preview; no persisted site overrides.
  const inspector = mountDevMode({
    root: preview,
    config,
    store,
    handle,
    vocabulary: siteVocabulary(),
    policy:
      'playground-policy: dev-mode\n  entry element\n  write-layers session\n',
  });
  const unsubscribe = config.subscribe((events) => {
    const ops = events.map((event) => {
      const values = config.resolve(
        event.id,
        event.name,
        event.key ?? undefined
      )?.value;
      return event.mode === 'positional'
        ? { op: 'setPositional', id: event.id, values: values ?? [] }
        : {
            op: values ? 'setProp' : 'removeProp',
            id: event.id,
            name: event.name,
            values,
          };
    });
    const edited = applyOpsToSource(editor.value, ops, {
      vocabulary: siteVocabulary(),
    });
    const candidate = edited.ok ? edited.text : format(config.effective());
    const validated = validateDocument(candidate);
    showErrors(validated.errors);
    if (validated.errors.length) {
      return;
    }
    editor.value = candidate;
    lineNumbers();
    for (const op of ops) {
      const node = validated.tree.byId.get(op.id);
      if (op.op === 'setPositional') {
        store.setPositional(op.id, node.positional);
      } else {
        const property = node.properties.find((p) => p.name === op.name);
        if (property) {
          store.setProp(op.id, op.name, property.values);
        } else {
          store.removeProp(op.id, op.name);
        }
      }
    }
    handle.flush();
  });
  return {
    inspector,
    config,
    store,
    destroy() {
      unsubscribe();
      inspector.destroy();
      handle.destroy();
      preview.replaceChildren();
    },
  };
}
