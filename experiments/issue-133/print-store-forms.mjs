// Prints the nested form of the ui-store doc examples (#133).
import { formatLinks, parseLinks } from '@link-foundation/ui-core';
const show = (text) => console.log(`${formatLinks(parseLinks(text))}---`);
show("(document_tree (roots (e (id ok) (kind button) (pos) (props (p label (s OK))) (children) (unknown))) (unknown))");
show("(tx 1 (origin devmode) (label 'Edit label') (setProp ok label Cancel) (move ok (parent main) (at 1)))\n(tx 2 (origin undo) (undoes 1) (move ok (parent main) (at 0)) (setProp ok label OK))");
