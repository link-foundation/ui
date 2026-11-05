// Why is a static accordion with (open true) still closed? Prints the diagnostics.
import { parse } from '@link-foundation/ui-core';
import { renderToHTML } from '@link-foundation/ui-dom';
import {
  controlsVocabulary,
  registerControls,
} from '../packages/ui-components/src/controls/index.js';
registerControls();
console.log(
  renderToHTML(
    parse(`(a: accordion One (open true))`, {
      vocabulary: controlsVocabulary(),
    }),
    { onDiagnostic: (d) => console.log(d) }
  )
);
