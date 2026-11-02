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
 * `(text 'Item' ...)` children stay two separate nodes.
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
 * The folder (the projector) provides:
 * - `place(frame, link)`: place one link by the element rules and return the
 *   frame of the node it created, or `null` for an atom;
 * - `canDeclare(frame, path)`: whether an unknown path may be declared here;
 * - `keepVerbatim(frame, link)`: keep a path link that cannot be folded;
 * - `global`: document-wide structural keys -> frames.
 * @param {object} folder
 * @param {object} frame
 * @param {Link} link a path link
 * @returns {object|null} the frame the payload went to
 */
export function foldPathLink(folder, frame, link) {
  const [path, ...payload] = link.values;
  const wrapper = isGroupWrapper(link);
  let found = wrapper ? null : lookup(folder, frame, path);
  if (!found) {
    if (!wrapper && !folder.canDeclare(frame, path)) {
      return folder.keepVerbatim(frame, link);
    }
    // Not known yet: declare the path here (the head of a multi-line group,
    // or an element or property head), then give it the payload.
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
