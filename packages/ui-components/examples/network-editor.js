import { createNetworkPresentation } from '../src/links-view/presentation.js';
import { createNetworkEditor } from '../src/links-view/network-editor/editor.js';
import {
  fromOptions,
  toOptions,
  fromParams,
} from '../src/links-view/network-editor/options.js';
import { decode, indexOf } from '../src/links-view/configurations.js';
import { buildNetwork } from '../src/links-view/network-model.js';
import { circle } from '../src/links-view/layouts/circle.js';
import { networkToSvg } from '../src/links-view/export.js';
import { linkColors } from '../src/links-view/tokens.js';

// This example adapts the existing public renderer; it does not emulate #227.
const presentation = createNetworkPresentation({
  geometry({ input }) {
    const options = fromOptions(input.options);
    return {
      positions: circle(buildNetwork(input.items), {
        width: options.width,
        height: options.height,
      }),
      pins: new Map(),
      bounds: { x: 0, y: 0, width: options.width, height: options.height },
    };
  },
  svg({ input, frame }) {
    const options = fromOptions(input.options);
    const colors = {
      ...linkColors(),
      line: options.color,
      source: options.color,
      target: options.color,
      background:
        options['background.type'] === 'transparent'
          ? 'transparent'
          : options['background.color'],
    };
    return networkToSvg(buildNetwork(input.items), frame.positions, {
      width: options.width,
      height: options.height,
      colors,
    });
  },
});
const params = new globalThis.URLSearchParams(globalThis.location.search);
const links = decode(params.get('code') || '11 22 12');
await presentation.update({
  items: links.map(([source, target], i) => ({
    id: String(i + 1),
    source: String(source),
    target: String(target),
  })),
  index: String(indexOf(links)),
  options: toOptions(fromParams(params)),
});
const preview = globalThis.document.getElementById('preview');
const draw = () => {
  preview.innerHTML = presentation.toSvg();
};
presentation.subscribe(draw);
draw();
const editor = createNetworkEditor(
  globalThis.document.getElementById('editor'),
  { presentation }
);
globalThis.networkEditorExample = { presentation, editor };
globalThis.addEventListener('pagehide', () => {
  editor.dispose();
  presentation.dispose();
});
