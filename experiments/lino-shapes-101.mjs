import { parseLinks, formatLinks } from '@link-foundation/ui-core';
for (const t of [
  '(create: (0 0))',
  "(set-name: (2 'a pair'))",
  '(each: (* * *))',
  '() ((1: 0 0))',
  '((($i: $s $t)) (($i: $t $s)))',
  '(count: ())',
  "(get-by-name: 'a pair')",
  '(delete: 1)',
  '',
]) {
  try {
    const l = parseLinks(t);
    console.log(JSON.stringify(t), JSON.stringify(l));
    console.log('  ->', JSON.stringify(formatLinks(l)));
  } catch (e) {
    console.log(t, 'ERR', e.message);
  }
}
