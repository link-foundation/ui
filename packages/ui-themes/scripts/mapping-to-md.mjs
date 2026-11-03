/* global URL */
import { format } from 'prettier';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { getSwiftuiMapping } from '../src/index.js';
import { getMuiMapping } from '../src/material3/mapping.js';
import { mappingTable } from '../src/mapping.js';

/** Deterministic documentation generated from the canonical LiNo table. */
export async function mappingMarkdown() {
  const rows = await getMuiMapping();
  return format(
    `# Material 3 and MUI mapping

Rendered by \`node packages/ui-themes/scripts/mapping-to-md.mjs\`; edit
\`themes/material3/mui-mapping.lino\` as the canonical table.

Load \`material3\` with \`loadTheme('material3')\`. The committed baseline seed
is \`#6750A4\`; colors come from material-color-utilities 0.3.0, tonal-spot.
\`materialThemeFromSeed(seed, { id, variant, contrast })\` returns a LiNo theme
extending material3, with complete light, dark and high-contrast color roles.
Load that text alongside the shipped theme's chain with the #47 engine.
High contrast is a light scheme at contrast level 1 and wins over dark when
both axes are active. Contrast ranges from -1 to 1; variants are tonal-spot,
vibrant and neutral. Roboto is named, never bundled.

\`muiThemeToLino(options, { id })\` returns \`{ lino, unmapped }\`. It imports
palette roles, numeric spacing, border radius, font family, breakpoint values
and duration values. Unsupported leaf paths (including functions and arrays)
are reported, never executed. The theme's \`scheme\` metadata records
palette.mode; apply that scheme to the theme boundary. Dark palette overrides
are scoped to dark mode. Contrast adjustment remains the engine's job.

\`getMuiMapping()\` asynchronously reads the table into plain objects.
A target value \`*\` preserves the incoming value. All supported rows are
partial: only the explicit prop translations are promised. Unknown props,
JSX, sx and MUI X are outside this converter. A none row has no equivalent.

The [gallery](../../examples/themes/material3.html) shows the controls in all
three schemes. Source token names are recorded as \`(m3 md.sys.*)\` in each
token's metadata. Elevation height tokens preserve the M3 dp scale;
shadow tokens preserve the key and ambient layers (30% and 15%). The full corner token
uses 9999px to render a capsule. Motion emphasized easing retains its two
cubic segments normalized to their local coordinates, with the shared endpoint
in emphasized.join-x and emphasized.join-y. Compose these pieces to recover
the [published path](https://github.com/material-components/material-components-android/blob/master/docs/theming/Motion.md);
no single cubic approximation is presented as the M3 path.

${mappingTable(
  ['MUI component', 'UI kind', 'Status', 'Prop translations'],
  rows.map((row) => [
    row.component,
    row.kind ? `\`${row.kind}\`` : '—',
    row.status,
    row.props
      .map(
        (p) =>
          `\`${p.name}=${p.value}\` → \`${p.target.name}=${p.target.value}\``
      )
      .join('; ') || '—',
  ])
)}
`,
    { parser: 'markdown' }
  );
}
/** The mapping is generated; the surrounding HIG guide remains hand-written. */
export async function swiftuiTable() {
  const rows = await getSwiftuiMapping();
  return [
    '| SwiftUI view | UI kind | Status | Modifiers |',
    '| --- | --- | --- | --- |',
    ...rows.map(
      ({ name, kind, status, props }) =>
        `| ${name} | ${kind} | ${status} | ${props.map(({ property, value, target }) => `${property} ${value} → ${target.join(' ')}`).join('; ')} |`
    ),
  ].join('\n');
}
export async function generatedHigDoc() {
  const url = new URL('../../../docs/themes/hig.md', import.meta.url);
  const text = await readFile(url, 'utf8');
  const start = '<!-- generated:swiftui:start -->';
  const end = '<!-- generated:swiftui:end -->';
  return format(
    `${text.slice(
      0,
      text.indexOf(start) + start.length
    )}\n\n${await swiftuiTable()}\n\n${text.slice(text.indexOf(end))}`,
    { parser: 'markdown' }
  );
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await writeFile(
    new URL('../../../docs/themes/material3.md', import.meta.url),
    await mappingMarkdown()
  );
  await writeFile(
    new URL('../../../docs/themes/hig.md', import.meta.url),
    await generatedHigDoc()
  );
}
