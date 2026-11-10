import { createNetworkPresentation } from '../src/links-view/presentation.js';
import { createNetworkEditor } from '../src/links-view/network-editor/editor.js';
import {
  toOptions,
  fromParams,
} from '../src/links-view/network-editor/options.js';
import { decode, indexOf } from '../src/links-view/configurations.js';
import { createNetworkEditorProvider } from '../src/links-view/network-editor/provider.js';

const presentation = createNetworkPresentation(createNetworkEditorProvider());
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
