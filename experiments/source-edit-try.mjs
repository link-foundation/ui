// Try the source edits on the example of link-foundation/ui#22 and print each result.
import * as E from '../packages/ui-core/src/source/edit.js';

const text =
  "# primary action\n(ok: button\n  (label 'OK')   # shown on the button\n  (variant filled))\n";
const show = (title, r) => {
  console.log(`--- ${title}: ok=${r.ok}${r.ok ? '' : ` ${r.error}`}`);
  if (r.ok) {
    console.log(
      r.text +
        JSON.stringify(r.edits) +
        (r.references ? ` refs ${JSON.stringify(r.references)}` : '')
    );
  }
};
show('setProp', E.setProp(text, 'ok', 'label', ['Cancel']));
show('setProp new', E.setProp(text, 'ok', 'disabled', ['true']));
show('removeProp', E.removeProp(text, 'ok', 'variant'));
show('removeProp label', E.removeProp(text, 'ok', 'label'));
show('insertChild', E.insertChild(text, 'ok', 0, '(icon: text check)'));
show('insertRoot', E.insertChild(text, null, 0, '# new\n(t: text Hi)'));
show('insertRoot end', E.insertChild(text, null, 1, '(t: text Hi)'));
show('remove', E.removeNode(text, 'ok'));
show('rename', E.renameId(text, 'ok', 'confirm'));
const doc =
  "(app: document\n  # the header\n  (h: text 'Title')\n  (body: stack\n    (b: button (label Go)))) # end\n";
show('move h into body', E.moveNode(doc, 'h', 'body', 1));
show('move b to app 0', E.moveNode(doc, 'b', 'app', 0));
show('remove body', E.removeNode(doc, 'body'));
const ind =
  "app: document\n  # header\n  h: text 'Title'\n  body: stack\n    b: button\n      label Go # go\n";
show('ind move h', E.moveNode(ind, 'h', 'body', 1));
show('ind insert', E.insertChild(ind, 'body', 0, 'x: text X'));
show('ind remove b', E.removeNode(ind, 'b'));
show('ind setProp', E.setProp(ind, 'b', 'variant', ['filled']));
show('ind setProp h', E.setProp(ind, 'h', 'variant', ['filled']));
const one = '(app: document (h: text Title) (b: button (label Go)))\n';
show('one insert', E.insertChild(one, 'app', 1, '(x: text X)'));
show('one move', E.moveNode(one, 'b', 'app', 0));
show('one remove', E.removeNode(one, 'h'));
show('one setPositional', E.setPositional(one, 'h', ['New title', 'x']));
show('one insert empty', E.insertChild(one, 'h', 0, '(x: text X)'));
