/**
 * `<ui-diagram>` and `<ui-mermaid-view>` in jsdom, with a stub in place of
 * Mermaid: our renderer never imports Mermaid, `(renderer mermaid)` does,
 * and a Mermaid that fails to load leaves the source and an error on screen.
 */

import { describe, it, expect } from 'test-anywhere';
import { JSDOM } from 'jsdom';
import {
  MERMAID_CONFIG,
  defineDiagram,
  pickRenderer,
  parseDiagram,
  setMermaidImporter,
  toMermaid,
} from '@link-foundation/ui-components/diagrams';
import { fixture } from './fixtures.js';

/** A fresh window with both elements defined. */
function createWindow() {
  const { window } = new JSDOM('<!doctype html><html><body></body></html>');
  defineDiagram(window);
  return window;
}

/** A Mermaid stand-in counting imports and recording what it renders. */
function stubMermaid({ fail = null } = {}) {
  const calls = { imports: 0, config: null, rendered: [] };
  setMermaidImporter(async () => {
    calls.imports += 1;
    if (fail) {
      throw new Error(fail);
    }
    return {
      default: {
        initialize(config) {
          calls.config = config;
        },
        async render(id, text) {
          calls.rendered.push(text);
          return { svg: `<svg id="${id}"><text>drawn</text></svg>` };
        },
      },
    };
  });
  return calls;
}

/** Append an element with the given LiNo or Mermaid text, wait for it. */
async function mount(window, tag, text, attributes = {}) {
  const element = window.document.createElement(tag);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  element.textContent = text;
  window.document.body.appendChild(element);
  await settle(element);
  return element;
}

/** Wait until the element and every Mermaid view in it left `loading`. */
async function settle(element) {
  for (let i = 0; i < 50; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0));
    const views = [element, ...element.querySelectorAll('ui-mermaid-view')];
    if (views.every((view) => view.dataset.state !== 'loading')) {
      return;
    }
  }
  throw new Error('the diagram did not settle');
}

describe('<ui-diagram>', () => {
  it('draws the login flow with our SVG renderer, without Mermaid', async () => {
    const calls = stubMermaid();
    try {
      const window = createWindow();
      const element = await mount(
        window,
        'ui-diagram',
        fixture('login-flow.lino')
      );
      expect(calls.imports).toBe(0);
      expect(element.dataset.renderer).toBe('svg');
      expect(element.dataset.state).toBe('ready');
      const svg = element.querySelector('.ui-diagram-drawing svg');
      expect(svg.getAttribute('role')).toBe('img');
      expect(svg.getAttribute('aria-label')).toBe(
        'Flowchart login-flow: 3 nodes, 2 connections'
      );
      expect(element.model.id).toBe('login-flow');
    } finally {
      setMermaidImporter(null);
    }
  });

  it('lists the nodes and connections for screen readers', async () => {
    const window = createWindow();
    const element = await mount(
      window,
      'ui-diagram',
      fixture('login-flow.lino')
    );
    const lists = element.querySelectorAll('.ui-diagram-description ul');
    expect([...lists].map((list) => list.getAttribute('aria-label'))).toEqual([
      'Nodes of login-flow',
      'Connections of login-flow',
    ]);
    expect([...lists[1].children].map((item) => item.textContent)).toEqual([
      'Start leads to Signed in?',
      'Signed in? leads to Home (yes)',
    ]);
    expect(
      element.querySelector('.ui-diagram-description').getAttribute('style')
    ).toContain('clip-path:inset(50%)');
  });

  it('imports Mermaid for (renderer mermaid) and the renderer attribute', async () => {
    const calls = stubMermaid();
    try {
      const window = createWindow();
      const byAttribute = await mount(
        window,
        'ui-diagram',
        fixture('login-flow.lino'),
        { renderer: 'mermaid' }
      );
      expect(byAttribute.dataset.renderer).toBe('mermaid');
      expect(calls.imports).toBe(1);
      expect(calls.config).toEqual({ ...MERMAID_CONFIG });
      expect(calls.config.securityLevel).toBe('strict');
      expect(calls.rendered).toEqual([fixture('login-flow.mmd')]);
      const view = byAttribute.querySelector('ui-mermaid-view');
      expect(view.dataset.state).toBe('ready');
      expect(view.querySelector('svg').getAttribute('aria-label')).toBe(
        'Flowchart login-flow: 3 nodes, 2 connections'
      );

      const byLino = await mount(
        window,
        'ui-diagram',
        fixture('links-class.lino')
      );
      expect(byLino.dataset.renderer).toBe('mermaid');
      expect(calls.imports).toBe(1); // imported once, then cached
      expect(calls.rendered[1].startsWith('classDiagram')).toBe(true);
    } finally {
      setMermaidImporter(null);
    }
  });

  it('shows the source and the error when the LiNo is invalid', async () => {
    const window = createWindow();
    const text = '(f: diagram (edge (from a) (to b)))';
    const element = await mount(window, 'ui-diagram', text);
    expect(element.dataset.state).toBe('error');
    expect(element.querySelector('[role="alert"]').textContent).toBe(
      'The diagram has an error: link 1 of diagram "f": unknown node "a" in (edge (from a) (to b))'
    );
    expect(element.querySelector('pre code').textContent).toBe(text);
  });

  it('draws again when the source or the renderer changes', async () => {
    const calls = stubMermaid();
    try {
      const window = createWindow();
      const element = await mount(
        window,
        'ui-diagram',
        '(f: diagram (a: node))'
      );
      element.source = '(g: diagram (b: node) (c: node))';
      await settle(element);
      expect(element.querySelectorAll('.ui-diagram-node').length).toBe(2);
      element.setAttribute('renderer', 'mermaid');
      await settle(element);
      expect(element.dataset.renderer).toBe('mermaid');
      expect(calls.rendered).toEqual(['flowchart TD\n  b["b"]\n  c["c"]']);
    } finally {
      setMermaidImporter(null);
    }
  });
});

describe('<ui-mermaid-view>', () => {
  it('keeps the source and shows an error when Mermaid cannot load', async () => {
    const calls = stubMermaid({ fail: 'blocked by the network' });
    try {
      const window = createWindow();
      const source = fixture('login-flow.mmd');
      const view = await mount(window, 'ui-mermaid-view', source);
      expect(calls.imports).toBe(1);
      expect(view.dataset.state).toBe('error');
      expect(view.hasAttribute('aria-busy')).toBe(false);
      expect(view.querySelector('[role="alert"]').textContent).toBe(
        'The diagram could not be drawn with Mermaid (blocked by the network). Its source is shown instead.'
      );
      expect(view.querySelector('pre.ui-diagram-source code').textContent).toBe(
        source
      );
      expect(view.querySelector('svg')).toBeNull();

      // The next render tries the import again.
      stubMermaid();
      expect(await view.refresh()).toBe('ready');
    } finally {
      setMermaidImporter(null);
    }
  });

  it('shows the source while Mermaid loads', async () => {
    let release;
    setMermaidImporter(
      () =>
        new Promise((resolve) => {
          release = resolve;
        })
    );
    try {
      const window = createWindow();
      const view = window.document.createElement('ui-mermaid-view');
      view.textContent = 'flowchart TD\n  a --> b';
      window.document.body.appendChild(view);
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(view.dataset.state).toBe('loading');
      expect(view.getAttribute('aria-busy')).toBe('true');
      expect(view.querySelector('pre').textContent).toBe(
        'flowchart TD\n  a --> b'
      );
      release({
        initialize() {},
        render: async () => ({ svg: '<svg></svg>' }),
      });
      await settle(view);
      expect(view.dataset.state).toBe('ready');
    } finally {
      setMermaidImporter(null);
    }
  });

  it('rejects an importer that is not a function', () => {
    expect(() => setMermaidImporter('mermaid')).toThrow();
  });
});

describe('pickRenderer', () => {
  it('uses our renderer for flowcharts and states, Mermaid otherwise', () => {
    const flow = parseDiagram(fixture('login-flow.lino'));
    const sequence = parseDiagram(fixture('sign-in-sequence.lino'));
    expect(pickRenderer(flow)).toBe('svg');
    expect(pickRenderer(flow, 'mermaid')).toBe('mermaid');
    expect(pickRenderer(sequence)).toBe('mermaid');
    expect(pickRenderer(sequence, 'svg')).toBe('mermaid');
    expect(pickRenderer(parseDiagram(fixture('links-class.lino')))).toBe(
      'mermaid'
    );
    expect(toMermaid(sequence).startsWith('sequenceDiagram')).toBe(true);
  });
});
