import { defineLinksNetwork } from '../src/links-view/links-network.js';
import { createStore } from '@link-foundation/ui-store';

/** Deterministic rings with some references to link centres and free ends. */
export function sampleLinks(count) {
  return Array.from({ length: count }, (_, i) => ({
    id: `l${i}`,
    source: i % 7 === 0 && i > 0 ? `l${i - 1}` : `p${i}`,
    target: i % 19 === 0 ? 0 : `p${(i + 1) % count}`,
  }));
}

defineLinksNetwork();
const views = [...document.querySelectorAll('links-network')];
for (const [i, node] of views.entries()) {
  node.items = sampleLinks([10, 10, 10, 500, 5000][i]);
  node.addEventListener('activate', (event) => {
    document.querySelector('#action').textContent =
      `Inspect ${event.detail.id}`;
  });
  node.addEventListener('networkcontextmenu', (event) => {
    document.querySelector('#action').textContent =
      `Context menu for ${event.detail.id}`;
  });
}
views[3].view = { x: 0, y: 0, k: 0.5 };
views[4].view = { x: 0, y: 0, k: 0.5 };
for (const [control, attribute] of [
  ['layout', 'layout'],
  ['style', 'style-mode'],
  ['theme', 'theme'],
]) {
  document.getElementById(control).addEventListener('change', (event) => {
    for (const node of views) {
      node.setAttribute(attribute, event.target.value);
    }
  });
}
const download = (blob, name) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
document
  .getElementById('svg')
  .addEventListener('click', () =>
    download(
      new globalThis.Blob([views[0].toSvg()], { type: 'image/svg+xml' }),
      'network.svg'
    )
  );
document
  .getElementById('png')
  .addEventListener('click', async () =>
    download(await views[0].toPng(2), 'network.png')
  );
// Real ui-store integration, exposed only for the gallery's browser tests.
window.networkGallery = { sampleLinks, createStore, views };
