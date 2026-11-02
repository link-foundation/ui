// Probe: what links-notation returns for the token forms, and what ui-core parse() projects.
import { parseLinks, parse } from '@link-foundation/ui-core';
const multi = `(m3: theme
  (extends base)
  (token color.primary '#6750A4')
  (mode dark
    (token color.primary '#D0BCFF')
    (token x 1px))
  (token s (shadow (color '#000') (offset-x 1px))))
(base: theme (token a 1px))`;
const indented = `m3: theme
  (extends base)
  token color.primary '#6750A4'
  mode dark
    token color.primary '#D0BCFF'
    token x 1px`;
for (const t of [multi, indented]) {
  console.log(JSON.stringify(parseLinks(t)));
  const doc = parse(t, { checks: false });
  console.log(JSON.stringify(doc.roots, null, 0));
  console.log(JSON.stringify(doc.diagnostics.map((d) => d.code)));
}
