// Edge cases of the source edits: CRLF, quoting, references and refusals.
import * as S from '../packages/ui-core/src/source.js';

const show = (title, r) => console.log(`--- ${title}: ${JSON.stringify(r)}`);
const crlf =
  "# c\r\n(ok: button\r\n  (label 'OK') # x\r\n  (variant filled))\r\n";
show('crlf setProp', S.setProp(crlf, 'ok', 'label', ['Cancel']));
show('crlf insert', S.insertChild(crlf, null, 1, '(t: text Hi)'));
show('crlf remove', S.removeNode(crlf, 'ok'));
show(
  'quote',
  S.setProp('(ok: button (label OK))', 'ok', 'label', ['Say hi (now)'])
);
show(
  'refs',
  S.renameId(
    '(a: stack (b: text T) (c: text (for b)))\n(b2: text b)',
    'b',
    'bb'
  )
);
show('dup', S.renameId('(a: stack (b: text T))', 'b', 'a'));
show('into self', S.moveNode('(a: stack (b: stack))', 'a', 'b', 0));
show('missing', S.removeNode('(a: stack)', 'zz'));
show('note', S.setProp('(a: text A)', 'a', 'note', ['Why this is red']));
show('setPositional', S.setPositional('(a: text A)', 'a', ['Hello there']));
