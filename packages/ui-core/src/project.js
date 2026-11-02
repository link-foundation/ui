/**
 * Tree projection (docs/spec/elements.md, docs/spec/projection.md): turn the
 * `Link` objects returned by `links-notation` into UI elements.
 */

import { Link } from 'links-notation';
import { diagnostic } from './diagnostics.js';
import { foldPathLink } from './fold.js';
import { headText, isAtom, isPathLink, linkKey } from './links.js';

/*
 * A frame is the projector's view of one node of the tree:
 *   type:    'root' | 'element' | 'property' | 'value'
 *   node:    the root, the UiNode, or the values array of a property or value
 *   element: the UiNode the frame belongs to (null for the root)
 *   keys:    structural keys of the heads and paths known inside this node
 * Frames never leak into the tree, so the tree stays plain JSON.
 */
const newFrame = (type, node, element) => ({
  type,
  node,
  element,
  keys: new Map(),
});

/** Projects links into elements while collecting diagnostics. */
export class Projector {
  /**
   * @param {import('./types.js').Vocabulary} vocabulary
   */
  constructor(vocabulary) {
    this.vocabulary = vocabulary;
    /** @type {import('./types.js').Diagnostic[]} */
    this.diagnostics = [];
    /** @type {Map<string, import('./types.js').UiNode>} */
    this.byId = new Map();
    /** Document-wide element heads and paths (structural key -> frame). */
    this.global = new Map();
    this.root = newFrame('root', { children: [], unknown: [] }, null);
  }

  report(code, severity, at) {
    this.diagnostics.push(diagnostic(code, severity, at));
  }

  /** Project one top-level link of the document. */
  top(link) {
    this.place(this.root, link);
  }

  /**
   * Place one link into a frame by the element rules. Returns the frame of
   * the node it created (so later path links can find it), or `null`.
   * @param {object} frame
   * @param {Link} link
   */
  place(frame, link) {
    if (isPathLink(link)) {
      return foldPathLink(this, frame, link);
    }
    if (frame.type === 'property' || frame.type === 'value') {
      return this.appendValue(frame, link);
    }
    if (isAtom(link)) {
      if (frame.type === 'root') {
        return this.keepUnknown(frame, link, link.id);
      }
      frame.node.positional.push(link.id);
      return null;
    }
    if (link.id !== null) {
      return this.addElement(frame, link, link.id);
    }
    const head = headText(link);
    const spec =
      frame.type === 'element'
        ? this.vocabulary.kinds.get(frame.node.kind)
        : undefined;
    const property = spec?.properties.get(head);
    if (property) {
      return this.addProperty(frame, link, head, property);
    }
    if (this.vocabulary.kinds.has(head)) {
      return this.addElement(frame, link, null);
    }
    return this.keepUnknown(frame, link, head);
  }

  /**
   * Whether an unknown path may be declared in `frame` (docs/spec/projection.md):
   * an element head, a property head valid there, or a path made of them.
   * @param {object} frame
   * @param {Link} path
   */
  canDeclare(frame, path) {
    if (frame.type !== 'element' && frame.type !== 'root') {
      return false;
    }
    if (path.id !== null) {
      return true;
    }
    if (isPathLink(path)) {
      const [inner] = path.values;
      return (
        frame.keys.has(linkKey(inner)) ||
        this.global.has(linkKey(inner)) ||
        this.canDeclare(frame, inner)
      );
    }
    const head = headText(path);
    return (
      this.vocabulary.kinds.has(head) ||
      (frame.type === 'element' &&
        Boolean(
          this.vocabulary.kinds.get(frame.node.kind)?.properties.has(head)
        ))
    );
  }

  /**
   * Keep a path link that cannot be folded: as a plain value inside a
   * property, otherwise verbatim in `unknown` with `head: null`.
   */
  keepVerbatim(frame, link) {
    if (frame.type === 'property' || frame.type === 'value') {
      return this.appendValue(frame, link);
    }
    return this.keepUnknown(frame, link, null);
  }

  /** Register the frame created from `link` in its parent and itself. */
  remember(parent, link, frame) {
    const key = linkKey(link);
    parent.keys.set(key, frame);
    frame.keys.set(key, frame);
  }

  addElement(frame, link, id) {
    const [first, ...rest] = link.values;
    const kind = isAtom(first) ? first.id : null;
    /** @type {import('./types.js').UiNode} */
    const node = {
      id,
      kind,
      positional: [],
      properties: [],
      children: [],
      unknown: [],
    };
    frame.node.children.push(node);
    const child = newFrame('element', node, node);
    this.remember(frame, link, child);
    if (id !== null) {
      this.registerId(link, child);
    }
    if (kind === null) {
      this.report('missing-kind', 'error', { element: id });
      this.appendValue(newFrame('value', node.unknown, node), first);
    } else if (!this.vocabulary.kinds.has(kind)) {
      this.report('unknown-kind', 'warning', { element: id, kind });
    }
    for (const value of rest) {
      this.place(child, value);
    }
    return child;
  }

  registerId(link, frame) {
    const { id } = frame.node;
    if (this.byId.has(id)) {
      this.report('duplicate-id', 'error', { element: id });
    } else {
      this.byId.set(id, frame.node);
    }
    // Element heads are looked up document-wide: the whole first line and
    // the element link with only its atom values.
    this.global.set(linkKey(link), frame);
    this.global.set(linkKey(new Link(id, link.values.filter(isAtom))), frame);
  }

  addProperty(frame, link, name, spec) {
    const element = frame.node;
    const multi = spec.multi || this.vocabulary.multiValued.has(name);
    if (!multi) {
      const index = element.properties.findIndex((p) => p.name === name);
      if (index !== -1) {
        // Last wins: the earlier occurrence is removed.
        this.report('duplicate-property', 'warning', {
          element: element.id,
          property: name,
        });
        element.properties.splice(index, 1);
      }
    }
    /** @type {import('./types.js').UiProperty} */
    const property = { name, values: [] };
    element.properties.push(property);
    const propertyFrame = newFrame('property', property.values, element);
    this.remember(frame, link, propertyFrame);
    for (const value of link.values.slice(1)) {
      this.place(propertyFrame, value);
    }
    return propertyFrame;
  }

  /** Append a value; a nested link becomes an array (or `{ id, values }`). */
  appendValue(frame, link) {
    if (isAtom(link)) {
      frame.node.push(link.id);
      return null;
    }
    const values = [];
    frame.node.push(link.id === null ? values : { id: link.id, values });
    const valueFrame = newFrame('value', values, frame.element);
    this.remember(frame, link, valueFrame);
    for (const value of link.values) {
      this.place(valueFrame, value);
    }
    return valueFrame;
  }

  keepUnknown(frame, link, head) {
    const element = frame.type === 'root' ? null : frame.node.id;
    this.report('unknown-sublink', 'warning', { element, head });
    const holder = { ...frame, type: 'value', node: frame.node.unknown };
    return this.appendValue(holder, link);
  }

  /** The projected roots, top-level unknown links and the id index. */
  result() {
    return {
      roots: this.root.node.children,
      unknown: this.root.node.unknown,
      byId: this.byId,
      diagnostics: this.diagnostics,
    };
  }
}

/**
 * Project a list of top-level links.
 * @param {Link[]} links
 * @param {import('./types.js').Vocabulary} vocabulary
 */
export function projectLinks(links, vocabulary) {
  const projector = new Projector(vocabulary);
  for (const link of links) {
    projector.top(link);
  }
  return projector.result();
}

/**
 * Project one link into an element by the element rules. Returns `null` when
 * the link is not an element (it would be an unknown top-level link).
 * Diagnostics are appended to `diagnostics` when it is given.
 * @param {Link} link
 * @param {import('./types.js').Vocabulary} vocabulary
 * @param {import('./types.js').Diagnostic[]} [diagnostics]
 * @returns {import('./types.js').UiNode | null}
 */
export function projectLink(link, vocabulary, diagnostics) {
  const { roots, diagnostics: found } = projectLinks([link], vocabulary);
  diagnostics?.push(...found);
  return roots[0] ?? null;
}
