/**
 * `walk(doc, visitor)`: visit every element depth-first, in source order.
 */

/**
 * Visit every element of a document (or of one node) depth-first, parents
 * before their children. Returning `false` from the visitor skips the
 * children of that element.
 * @param {import('./types.js').UiDocument | import('./types.js').UiNode} root
 * @param {(node: import('./types.js').UiNode,
 *          parent: import('./types.js').UiNode | null,
 *          depth: number) => boolean | void} visitor
 */
export function walk(root, visitor) {
  const top = Array.isArray(root.roots) ? root.roots : [root];
  // An explicit stack, not recursion: a deep tree cannot overflow.
  const stack = top.map((node) => [node, null, 0]).reverse();
  while (stack.length > 0) {
    const [node, parent, depth] = stack.pop();
    if (visitor(node, parent, depth) === false) {
      continue;
    }
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push([node.children[i], node, depth + 1]);
    }
  }
}
