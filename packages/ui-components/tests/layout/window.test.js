/**
 * window kind: a non-modal dialog that moves with its header and with
 * Alt+Arrow, resizes with Alt+Shift+Arrow, stays inside the viewport,
 * closes with Escape and gives the focus back to its opener.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  clampRect,
  createLayerManager,
  windowController,
} from '@link-foundation/ui-components';
import { mountLayout, pointer, press, setViewport } from './helpers.js';

const WINDOW = `(inspector: window (title Inspector) (open false)
  (x 100)
  (y 80)
  (width 320)
  (height 200)
  (ok: button 'OK'))`;

/** Open the window from the #opener button, as an action would. */
function open(page) {
  page.document.getElementById('opener').focus();
  page.store.setProp('inspector', 'open', ['true']);
  page.handle.flush();
  return page.node('inspector');
}

describe('window kind', () => {
  it('starts hidden and opens as a labelled dialog that takes the focus', async () => {
    const page = await mountLayout(WINDOW);
    const node = page.node('inspector');
    expect(node.hidden).toBe(true);
    open(page);
    expect(node.hidden).toBe(false);
    expect(node.getAttribute('role')).toBe('dialog');
    const title = page.document.getElementById(
      node.getAttribute('aria-labelledby')
    );
    expect(title.textContent).toBe('Inspector');
    expect(page.document.activeElement).toBe(
      page.node('ok').querySelector('button')
    );
    expect(node.style.left).toBe('100px');
    expect(node.style.top).toBe('80px');
    expect(node.style.width).toBe('320px');
    expect(
      node.querySelector('.ui-window-close').getAttribute('aria-label')
    ).toBe('Close Inspector');
    expect(page.diagnostics).toEqual([]);
    page.close();
  });

  it('moves with Alt+Arrow and resizes with Alt+Shift+Arrow', async () => {
    const page = await mountLayout(WINDOW);
    const node = open(page);
    const changes = [];
    node.addEventListener('window-change', (e) => changes.push(e.detail.rect));
    const { frame } = windowController(node);
    press(page.node('ok'), 'ArrowRight', { altKey: true });
    press(page.node('ok'), 'ArrowDown', { altKey: true });
    expect(frame.rect).toEqual({ x: 116, y: 96, width: 320, height: 200 });
    press(page.node('ok'), 'ArrowLeft', { altKey: true, shiftKey: true });
    expect(frame.rect).toEqual({ x: 116, y: 96, width: 304, height: 200 });
    expect(changes.length).toBe(3);
    // A plain arrow is left to the control that has the focus.
    expect(press(page.node('ok'), 'ArrowRight').defaultPrevented).toBe(false);
    page.close();
  });

  it('cannot be moved outside the viewport by the keyboard', async () => {
    const page = await mountLayout(WINDOW, { width: 800, height: 600 });
    const node = open(page);
    const { frame } = windowController(node);
    for (let i = 0; i < 100; i++) {
      press(node, 'ArrowRight', { altKey: true });
      press(node, 'ArrowDown', { altKey: true });
    }
    expect(frame.rect).toEqual({ x: 480, y: 400, width: 320, height: 200 });
    for (let i = 0; i < 100; i++) {
      press(node, 'ArrowLeft', { altKey: true });
      press(node, 'ArrowUp', { altKey: true });
    }
    expect(frame.rect).toEqual({ x: 0, y: 0, width: 320, height: 200 });
    page.close();
  });

  it('cannot be dragged outside the viewport by its header', async () => {
    const page = await mountLayout(WINDOW, { width: 800, height: 600 });
    const node = open(page);
    const header = node.querySelector('.ui-window-header');
    pointer(header, 'pointerdown', { clientX: 150, clientY: 90 });
    pointer(header, 'pointermove', { clientX: 250, clientY: 140 });
    expect(windowController(node).frame.rect.x).toBe(200);
    pointer(header, 'pointermove', { clientX: 5000, clientY: -900 });
    pointer(header, 'pointerup', { clientX: 5000, clientY: -900 });
    expect(windowController(node).frame.rect).toEqual({
      x: 480,
      y: 0,
      width: 320,
      height: 200,
    });
    // Another pointer does not move it.
    pointer(header, 'pointermove', { clientX: 0, clientY: 0, pointerId: 2 });
    expect(windowController(node).frame.rect.x).toBe(480);
    page.close();
  });

  it('is clamped when it starts outside and when the viewport shrinks', async () => {
    const page = await mountLayout(
      WINDOW.replace('(x 100)', '(x 5000)').replace('(open false)', ''),
      { width: 1024, height: 768 }
    );
    const node = page.node('inspector');
    expect(node.hidden).toBe(false);
    expect(windowController(node).frame.rect.x).toBe(704);
    setViewport(page.window, 400, 240);
    page.window.dispatchEvent(new page.window.Event('resize'));
    expect(windowController(node).frame.rect).toEqual({
      x: 80,
      y: 40,
      width: 320,
      height: 200,
    });
    page.close();
  });

  it('closes with Escape, gives the focus back and tells the app', async () => {
    const page = await mountLayout(WINDOW);
    const node = open(page);
    const closed = [];
    node.addEventListener('window-close', (e) => closed.push(e.detail));
    press(page.node('ok'), 'Escape');
    expect(node.hidden).toBe(true);
    expect(page.document.activeElement.id).toBe('opener');
    expect(closed).toEqual([{ id: 'inspector' }]);
    page.close();
  });

  it('closes with its close button', async () => {
    const page = await mountLayout(WINDOW);
    const node = open(page);
    node.querySelector('.ui-window-close').click();
    expect(node.hidden).toBe(true);
    expect(page.document.activeElement.id).toBe('opener');
    page.close();
  });

  it('does not close with Escape when (closable false)', async () => {
    const page = await mountLayout(
      WINDOW.replace('(open false)', '(open false) (closable false)')
    );
    const node = open(page);
    press(page.node('ok'), 'Escape');
    expect(node.hidden).toBe(false);
    expect(node.querySelector('.ui-window-close').hidden).toBe(true);
    page.close();
  });

  it('is raised in the window layer and stays below a modal', async () => {
    const layers = createLayerManager();
    layers.register('modal', 'modal');
    const page = await mountLayout(
      `${WINDOW}
(other: window (title Other) (x 10) (y 10) (b: button 'B'))`,
      { layout: { layers } }
    );
    const inspector = open(page);
    const other = page.node('other');
    const z = (node) => Number(node.style.zIndex);
    expect(z(inspector) > z(other)).toBe(true);
    page.node('b').querySelector('button').focus();
    expect(z(other) > z(inspector)).toBe(true);
    expect(z(other) < layers.zIndexOf('modal')).toBe(true);
    pointer(inspector, 'pointerdown');
    expect(z(inspector) > z(other)).toBe(true);
    expect(z(inspector) < layers.zIndexOf('modal')).toBe(true);
    page.close();
  });
});

describe('clampRect', () => {
  it('keeps a rectangle inside the viewport and no larger than it', () => {
    const viewport = { width: 800, height: 600 };
    expect(
      clampRect({ x: -50, y: 900, width: 300, height: 200 }, viewport)
    ).toEqual({
      x: 0,
      y: 400,
      width: 300,
      height: 200,
    });
    expect(
      clampRect({ x: 10, y: 10, width: 2000, height: 50 }, viewport)
    ).toEqual({
      x: 0,
      y: 10,
      width: 800,
      height: 96,
    });
  });
});
