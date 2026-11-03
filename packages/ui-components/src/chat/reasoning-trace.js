import {
  atomOf,
  chatOptions,
  chatRecords,
  make,
  registerChatKind,
} from './dom.js';

/** Nested disclosure tree; cycles/orphans are reported as roots, never recurse forever. */
export function drawReasoning(node, steps, { document, labels = {} }) {
  const byId = new Map(steps.map((step) => [step.id, step]));
  const children = new Map();
  for (const step of steps) {
    const parent = byId.has(step.parent) ? step.parent : null;
    if (!children.has(parent)) {
      children.set(parent, []);
    }
    children.get(parent).push(step);
  }
  const visited = new Set();
  const draw = (step) => {
    if (visited.has(step.id)) {
      return null;
    }
    visited.add(step.id);
    const details = make(document, 'details', {
      class: 'ui-chat-step',
      open: true,
      'data-state': step.state,
    });
    details.append(
      make(
        document,
        'summary',
        {},
        `${step.title} · ${labels[step.state] ?? step.state}`
      )
    );
    if (step.text) {
      details.append(make(document, 'p', {}, step.text));
    }
    for (const child of children.get(step.id) ?? []) {
      const rendered = draw(child);
      if (rendered) {
        details.append(rendered);
      }
    }
    return details;
  };
  const result = [];
  for (const step of [...(children.get(null) ?? []), ...steps]) {
    const rendered = draw(step);
    if (rendered) {
      result.push(rendered);
    }
  }
  node.replaceChildren(...result);
  node.setAttribute('aria-label', labels.reasoning ?? 'Reasoning');
  node.setAttribute('role', 'group');
}
registerChatKind('reasoning-trace', (node, _el, ctx) => ({
  update: (el) =>
    drawReasoning(
      node,
      chatRecords(ctx).filter(
        (r) => r.kind === 'step' && r.message === atomOf(el, 'record')
      ),
      { document: ctx.document, ...chatOptions(ctx) }
    ),
}));
