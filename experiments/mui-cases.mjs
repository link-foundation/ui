// Print importJsx output for each MUI snippet given as an argument.
import { importJsx } from '../packages/ui-convert/src/index.js';
for (const c of process.argv.slice(2)) {
  const r = importJsx(c);
  console.log(
    JSON.stringify([
      c,
      r.text,
      [...r.applied.values()][0] ?? null,
      r.diagnostics.map((d) => d.code),
    ])
  );
}
