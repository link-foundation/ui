import { Parser } from 'links-notation';
for (const n of [63, 64, 65, 70, 130]) {
  const lines = Array.from({ length: n + 1 }, (_, i) => ' '.repeat(i) + 'x' + i).join('\n');
  try { new Parser({ maxDepth: 64 }).parse(lines); console.log(n, 'ok'); }
  catch (e) { console.log(n, e.message, e.location?.start); }
}
