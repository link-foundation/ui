import { describe, it, expect } from 'test-anywhere';
import { createDom, press } from '../../support/dom.js';
import { mountDocument } from '@link-foundation/ui-dom';
import { createStore } from '@link-foundation/ui-store';
import {
  defineLinksNetwork,
  registerLinksNetworkKind,
} from '../../../src/links-view/links-network.js';
import { networkToSvg } from '../../../src/links-view/export.js';
import { readNetworkSource } from '../../../src/links-view/network-source.js';
import { networkVocabulary } from '../../../src/links-view/network-vocabulary.js';
import { runLayoutJob } from '../../../src/links-view/layout-worker.js';

function setup() {
  const { window, document } = createDom();
  defineLinksNetwork(window, { animator: { reducedMotion: () => true } });
  const node = document.createElement('links-network');
  document.body.append(node);
  return { window, document, node };
}

const source = `graph: links-network
  layout grid
  style node-edge
  labels
    min-zoom 0.7
  items
    link
      id a
      source p
      target q
    link
      id b
      source a
      target 0
`;

describe('links-network source, worker and element', () => {
  it('reads nested LiNo with the official projection', () => {
    const config = readNetworkSource(source);
    expect(config.layout).toBe('grid');
    expect(config.style).toBe('node-edge');
    expect(config.minZoom).toBe(0.7);
    expect(
      config.links.map((link) => [link.id, link.source, link.target])
    ).toEqual([
      ['a', 'p', 'q'],
      ['b', 'a', '0'],
    ]);
  });
  it('reports unknown worker layouts without throwing across the boundary', () => {
    expect(
      runLayoutJob({ key: 'x', id: 1, job: { layout: 'missing', links: [] } })
        .error
    ).toBe('Unknown layout: missing');
  });
  it('preserves SVG items on store insert/update/remove and exports exactly the preview', async () => {
    const { window, node } = setup();
    const store = createStore({ text: 'a: link\n  source p\n  target q\n' });
    node.store = store;
    await node.ready;
    const first = node.shadowRoot.querySelector('[data-id="a"]');
    store.insert(null, undefined, {
      id: 'b',
      kind: 'link',
      properties: [
        { name: 'source', values: ['p'] },
        { name: 'target', values: ['q'] },
      ],
    });
    expect(node.shadowRoot.querySelector('[data-id="a"]')).toBe(first);
    expect(node.shadowRoot.querySelectorAll('[data-id]').length).toBe(2);
    store.setProp('b', 'target', ['a']);
    expect(node.shadowRoot.querySelector('[data-id="a"]')).toBe(first);
    expect(node.toSvg()).toBe(node.shadowRoot.querySelector('svg').outerHTML);
    expect(
      networkToSvg(node.network, node.positions).includes('data-id="b"')
    ).toBe(true);
    store.rename('b', 'c');
    expect(node.network.links.has('b')).toBe(false);
    expect(node.network.links.has('c')).toBe(true);
    expect(node.shadowRoot.querySelector('[data-id="a"]')).toBe(first);
    store.remove('c');
    expect(node.shadowRoot.querySelectorAll('[data-id]').length).toBe(1);
    node.remove();
    store.remove('a');
    expect(node.items.length).toBe(1);
    window.close();
  });
  it('reports layout failures, recovers and removes obsolete selections', async () => {
    const { window, node } = setup();
    node.items = [{ id: 'a', source: 'p', target: 'q' }];
    await node.ready;
    node.select('a');
    node.items = [{ id: 'b', source: 'r', target: 's' }];
    await node.ready;
    expect(node.selection).toEqual([]);
    node.setAttribute('layout', 'missing');
    expect(await node.ready.catch((e) => e.message)).toBe(
      'Unknown layout: missing'
    );
    expect(node.diagnostics.length).toBe(1);
    node.setAttribute('layout', 'grid');
    await node.ready;
    expect(node.diagnostics).toEqual([]);
    Object.defineProperty(node, 'clientWidth', { value: 800 });
    node.requestDraw();
    expect(node.toSvg()).toBe(node.shadowRoot.querySelector('svg').outerHTML);
    window.close();
  });
  it('fires LiNo on activate with the selected item through ui-dom', async () => {
    const { window, document } = createDom();
    registerLinksNetworkKind(window, {
      animator: { reducedMotion: () => true },
    });
    const app = document.createElement('main');
    document.body.append(app);
    const actions = [];
    const mounted = mountDocument(
      app,
      `${source}  on activate\n    emit inspected\n      param item.id\n`,
      {
        document,
        parseOptions: { vocabulary: networkVocabulary() },
        onAction: (detail) => actions.push(detail.action),
      }
    );
    const node = app.querySelector('links-network');
    await node.ready;
    node.select('a');
    press(node, 'Enter');
    expect(actions).toEqual([['emit', 'inspected', 'a']]);
    mounted.handle.destroy();
    window.close();
  });
  it('supports keyboard neighbour navigation, activation and deselection', async () => {
    const { window, node } = setup();
    press(node, 'Home');
    press(node, 'ArrowRight');
    expect(node.selection).toEqual([]);
    node.items = [
      { id: 'a', source: 'p', target: 'q' },
      { id: 'b', source: 'p', target: 'q' },
    ];
    await node.ready;
    node.positions = new Map([
      ['p', { x: 20, y: 40 }],
      ['a', { x: 100, y: 40 }],
      ['q', { x: 180, y: 40 }],
    ]);
    const pointer = (type, x, y) => {
      const event = new window.MouseEvent(type, {
        clientX: x,
        clientY: y,
        button: 0,
      });
      node.dispatchEvent(event);
    };
    pointer('pointerdown', 20, 40);
    pointer('pointermove', 25, 45);
    pointer('pointerup', 25, 45);
    await node.layout();
    expect(node.positions.get('p')).toEqual({ x: 25, y: 45 });
    node.positions = new Map([
      ['p', { x: 20, y: 40 }],
      ['a', { x: 100, y: 40 }],
      ['q', { x: 180, y: 40 }],
    ]);
    node.select('p');
    press(node, 'ArrowRight');
    expect(node.selection).toEqual(['a']);
    let activated;
    node.addEventListener('activate', (event) => {
      activated = event.detail.id;
    });
    press(node, 'Enter');
    expect(activated).toBe('a');
    press(node, 'Escape');
    expect(node.selection).toEqual([]);
    window.close();
  });
});
