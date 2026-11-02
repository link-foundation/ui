// Probe: links-notation's BinaryLinoCodec as the canonical document model of
// the link-cli protocols (text formatDocument + binary encode/decode).
import { BinaryLinoCodec, Link } from 'links-notation';

const codec = new BinaryLinoCodec();
for (const text of [
  '() ((1: 0 0))',
  '(count: ())',
  "(set-name: (2 'a pair'))",
  '((1: 2 2)) ()',
  "(error: 'Link not found: 7')",
  '(1: 2 2)\n(2: 1 1)',
  '',
  '((($i: $s $t)) (($i: $t $s)))',
]) {
  const doc = codec.parseDocument(text);
  const back = codec.formatDocument(doc);
  const bytes = codec.encode(doc);
  const again = codec.formatDocument(codec.decode(bytes));
  console.log(
    JSON.stringify(text),
    '->',
    JSON.stringify(back),
    back === again,
    Buffer.from(bytes).toString('hex')
  );
}
console.log(
  codec.formatDocument([
    new Link(null, [
      new Link(null, []),
      new Link(null, [new Link('1', [new Link('0'), new Link('0')])]),
    ]),
  ])
);
