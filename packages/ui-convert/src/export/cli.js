import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportDocument } from './index.js';

/** Write source files, or concatenate source and CSS to stdout in file order. */
export async function exportCommand(args, text, io, diagnosticText) {
  const result = await exportDocument(text, args);
  if (args.out) {
    mkdirSync(args.out, { recursive: true });
    for (const file of result.files) {
      writeFileSync(join(args.out, file.path), file.contents);
    }
  } else {
    io.stdout.write(result.files.map((file) => file.contents).join('\n'));
  }
  for (const diagnostic of result.diagnostics) {
    io.stderr.write(`${diagnosticText(diagnostic)}\n`);
  }
  return result.diagnostics.some((d) => d.severity === 'error') ? 1 : 0;
}
