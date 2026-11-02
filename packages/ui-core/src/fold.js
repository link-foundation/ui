/**
 * Path folding (docs/spec/projection.md).
 *
 * `links-notation` returns a document written over several lines as path
 * links: the multi-line form gives `(H (H a) (H b))`, the indented form gives
 * `H`, `(H a)`, `((H a) b)`. Folding appends the payload of every path link
 * to the node its path names, so all forms give the same tree.
 */

import { Link } from 'links-notation';
import { isPathLink, linkKey } from './links.js';

/**
 * A multi-line group as the parser returns it: `(H (H a) (H b) ...)`, a path
 * link whose every payload value is a path link with the same path `H`.
 *
 * Its head `H` always declares a new node, even when an equal head was seen
 * before, so that two multi-line `(on press ...)` handlers or two multi-line
 * `(text 'Item' ...)` children stay two nodes instead of being merged.
 * @param {Link} link
 * @returns {boolean}
 */
export function isGroupWrapper(link) {
  if (!isPathLink(link) || link.values.length < 2) {
    return false;
  }
  const key = linkKey(link.values[0]);
  return link.values
    .slice(1)
    .every((value) => isPathLink(value) && linkKey(value.values[0]) === key);
}

/**
 * Find the node a path names: heads and paths known in the current node
 * first, then (for elements and the root) document-wide element heads.
 * @returns {{ target: object, scope: Map<string, object> } | null}
 */
function lookup(folder, frame, path) {
  const key = linkKey(path);
  const local = frame.keys.get(key);
  if (local) {
    return { target: local, scope: frame.keys };
  }
  const global =
    frame.type === 'element' || frame.type === 'root'
      ? folder.global.get(key)
      : undefined;
  return global ? { target: global, scope: folder.global } : null;
}

/**
 * Fold a path link `(path payload...)` into `frame`.
 *
 * `folder.place(frame, link)` places one link by the element rules and
 * returns the node (frame) it created, or `null` for an atom.
 * `folder.global` maps document-wide keys to frames.
 * @param {{ place: Function, global: Map<string, object> }} folder
 * @param {object} frame
 * @param {Link} link a path link
 * @returns {object} the frame the payload went to
 */
export function foldPathLink(folder, frame, link) {
  const [path, ...payload] = link.values;
  let found = isGroupWrapper(link) ? null : lookup(folder, frame, path);
  if (!found) {
    // Not known yet: declare the path here (a head of the multi-line form),
    // then give it the payload.
    found = { target: folder.place(frame, path), scope: frame.keys };
  }
  const { target, scope } = found;
  if (!target) {
    return null;
  }
  for (const value of payload) {
    const created = folder.place(target, value);
    if (created) {
      scope.set(linkKey(new Link(null, [path, value])), created);
    }
  }
  return target;
}
