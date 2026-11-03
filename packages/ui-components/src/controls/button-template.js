/** Template data replaces the visual part tree; the native button keeps its semantics. */
import { resolveTemplate } from '@link-foundation/ui-tokens/themes';
import { partOf } from './dom.js';

export function buttonParts(button, ctx, kind) {
  const template = resolveTemplate(ctx.theme?.(), kind);
  if (!template) {
    return false;
  }
  const doc = ctx.document;
  const append = (part, parent) => {
    const tag =
      part.name === 'icon' ? 'ui-icon' : part.kind === 'box' ? 'div' : 'span';
    const node = partOf(doc, tag, part.name);
    if (part.name === 'icon' || part.name === 'indicator') {
      node.setAttribute('aria-hidden', 'true');
    }
    for (const child of part.children) {
      append(child, node);
    }
    parent.appendChild(node);
  };
  for (const child of template.children) {
    append(child, button);
  }
  if (!button.querySelector('[data-part="icon"]')) {
    button.appendChild(
      partOf(doc, 'ui-icon', 'icon', { hidden: '', 'aria-hidden': 'true' })
    );
  }
  return true;
}
