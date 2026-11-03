import { writeFile } from 'node:fs/promises';
import {
  corners,
  lines,
  frameStyle,
} from '../../packages/ui-themes/src/classic/frames.js';
await writeFile(
  'packages/ui-themes/tests/fixtures/classic-frames.lino',
  corners
    .flatMap((corner) =>
      lines.map((line) => frameStyle({ corner, line, size: 12 }))
    )
    .join('\n')
);
