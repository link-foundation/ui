/* global requestAnimationFrame, MutationObserver, performance, PointerEvent */
import { test, expect } from '@playwright/test';
import { expectAccessible } from '../../../../tests/ui/helpers.mjs';

test.use({ trace: 'on' });

const gallery = '/packages/ui-components/examples/links-network.html';
const view = (page, id = 'circle') => page.locator(`#${id} links-network`);

async function open(page) {
  await page.goto(gallery);
  await page.waitForFunction(() =>
    window.networkGallery?.views.every(
      (el) => el.drawn && el.diagnostics.length === 0
    )
  );
  await page.evaluate(() =>
    Promise.all(window.networkGallery.views.map((el) => el.ready))
  );
}

async function point(page, id, figure = 'circle') {
  const box = await view(page, figure).boundingBox();
  const p = await view(page, figure).evaluate((el, key) => {
    const p = el.positions.get(key),
      v = el.view;
    return { x: p.x * v.k + v.x, y: p.y * v.k + v.y };
  }, id);
  return { x: box.x + p.x, y: box.y + p.y };
}

test('real worker layouts, both styles, exact preview export and PNG', async ({
  page,
}) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await open(page);
  for (const layout of [
    'circle',
    'grid',
    'hex',
    'spiral',
    'force',
    'layered',
  ]) {
    const equal = await view(page).evaluate(async (el, name) => {
      el.setAttribute('layout', name);
      await el.ready;
      const first = [...el.positions];
      await el.layout();
      return JSON.stringify(first) === JSON.stringify([...el.positions]);
    }, layout);
    expect(equal).toBe(true);
  }
  for (const style of ['glyph', 'node-edge']) {
    await view(page).evaluate((el, value) => {
      el.setAttribute('style-mode', value);
    }, style);
    await expect
      .poll(() =>
        view(page).evaluate(
          (el) => el.toSvg() === el.shadowRoot.querySelector('svg').outerHTML
        )
      )
      .toBe(true);
  }
  const png = await view(page).evaluate(async (el) => {
    const blob = await el.toPng(2);
    const bytes = new Uint8Array(await blob.arrayBuffer());
    return {
      type: blob.type,
      signature: [...bytes.slice(0, 8)],
      size: blob.size,
    };
  });
  expect(png.type).toBe('image/png');
  expect(png.signature).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(png.size).toBeGreaterThan(100);
  expect(errors).toEqual([]);
});

test('one inserted store link adds one item and preserves all existing items', async ({
  page,
}) => {
  await open(page);
  const mutations = await view(page).evaluate(async (el) => {
    const { createStore } = window.networkGallery;
    const store = createStore({ text: 'a: link\n  source p\n  target q\n' });
    el.store = store;
    await el.ready;
    el.view = { k: 0.5 };
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const group = el.shadowRoot.querySelector('[data-part="items"]');
    const first = group.firstElementChild;
    const records = [];
    const observer = new MutationObserver((batch) => records.push(...batch));
    observer.observe(group, {
      subtree: true,
      childList: true,
      attributes: true,
    });
    store.insert(null, undefined, {
      id: 'b',
      kind: 'link',
      positional: ['p', 'q'],
    });
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    observer.disconnect();
    return {
      same: group.firstElementChild === first,
      added: records.reduce((sum, record) => sum + record.addedNodes.length, 0),
      removed: records.reduce(
        (sum, record) => sum + record.removedNodes.length,
        0
      ),
      attributes: records.filter((record) => record.type === 'attributes')
        .length,
    };
  });
  expect(mutations).toEqual({
    same: true,
    added: 1,
    removed: 0,
    attributes: 0,
  });
});

test('pointer selection, multi-selection, neighbour highlight, pinning and context hook', async ({
  page,
}) => {
  await open(page);
  const a = await point(page, 'l1');
  await page.mouse.click(a.x, a.y);
  expect(await view(page).evaluate((el) => el.selection)).toEqual(['l1']);
  const b = await point(page, 'l2');
  await page.keyboard.down('Shift');
  await page.mouse.click(b.x, b.y);
  await page.keyboard.up('Shift');
  expect(await view(page).evaluate((el) => el.selection)).toEqual(['l1', 'l2']);
  await expect(view(page).locator('[data-highlighted="true"]')).not.toHaveCount(
    0
  );
  const p = await point(page, 'p1');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  await page.mouse.move(p.x + 25, p.y + 20, { steps: 3 });
  await page.mouse.up();
  expect(await view(page).evaluate((el) => el.pins.has('p1'))).toBe(true);
  await view(page).evaluate((el) => {
    el.addEventListener('networkcontextmenu', (e) => {
      el.dataset.contextId = e.detail.id;
    });
  });
  await page.mouse.click(a.x, a.y, { button: 'right' });
  await expect(view(page)).toHaveAttribute('data-context-id', 'l1');
});

test('keyboard operates SVG and Canvas, reduced motion and independent views', async ({
  page,
}) => {
  await open(page);
  for (const figure of ['circle', 'large']) {
    const node = view(page, figure);
    await node.evaluate((el) => {
      el.items =
        el.drawn.renderer === 'canvas'
          ? Array.from({ length: 2001 }, (_, i) => ({
              id: i === 0 ? 'a' : `extra${i}`,
              source: 'p',
              target: 'q',
            }))
          : [{ id: 'a', source: 'p', target: 'q' }];
    });
    await node.evaluate((el) => el.ready);
    await node.evaluate((el) => {
      el.select(null);
      el.positions = new Map([
        ...el.positions,
        ['p', { x: 20, y: 80 }],
        ['a', { x: 21, y: 80 }],
        ['q', { x: 220, y: 80 }],
      ]);
    });
    await node.focus();
    await node.evaluate((el) => el.select('p'));
    await page.keyboard.press('ArrowRight');
    expect(await node.evaluate((el) => el.selection)).toEqual(['a']);
    await page.keyboard.press('Enter');
    await expect(page.locator('#action')).toHaveText('Inspect a');
    await page.keyboard.press('Shift+F10');
    await expect(page.locator('#action')).toHaveText('Context menu for a');
    await page.keyboard.press('Escape');
    expect(await node.evaluate((el) => el.selection)).toEqual([]);
    await page.keyboard.press('+');
    await page.keyboard.press('Alt+ArrowRight');
    expect(await node.evaluate((el) => el.view.x)).not.toBe(0);
    await page.keyboard.press('0');
    expect(await node.evaluate((el) => el.view)).toEqual({ x: 0, y: 0, k: 1 });
  }
  expect(await view(page, 'hex').evaluate((el) => el.view.k)).toBe(1);
});

test('500 labels hide at low zoom; themes pass WCAG 2.2 AA', async ({
  page,
}) => {
  await open(page);
  await expect(
    view(page, 'medium').locator('[data-part="labels"] text')
  ).toHaveCount(0);
  for (const theme of ['light', 'dark']) {
    await page.getByLabel('Theme').selectOption(theme);
    await expectAccessible(page);
  }
});

test('5,000 Canvas links pan above 30 fps with a retained performance trace', async ({
  page,
}, info) => {
  await open(page);
  const node = view(page, 'large');
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await node.scrollIntoViewIfNeeded();
  const box = await node.boundingBox();
  await page.mouse.move(box.x + box.width - 10, box.y + box.height - 10);
  await node.evaluate((el) => {
    el.addEventListener(
      'pointerdown',
      (event) => {
        el.dataset.performancePointerId = String(event.pointerId);
      },
      { once: true }
    );
  });
  await page.mouse.down();
  expect(await node.evaluate((el) => el.drawn.renderer)).toBe('canvas');
  const result = await node.evaluate(async (el) => {
    const durations = [],
      draws = [];
    el.addEventListener('networkdraw', () => draws.push(performance.now()));
    const rect = el.getBoundingClientRect();
    const start = {
      clientX: rect.right - 10,
      clientY: rect.bottom - 10,
      pointerId: Number(el.dataset.performancePointerId),
      bubbles: true,
      button: 0,
    };
    let last = performance.now();
    for (let frame = 0; frame < 60; frame++) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      const now = performance.now();
      durations.push(now - last);
      last = now;
      el.dispatchEvent(
        new PointerEvent('pointermove', {
          ...start,
          clientX: start.clientX - frame * 2,
          clientY: start.clientY - frame,
        })
      );
    }
    return {
      durations,
      draws,
      fps: 60000 / durations.reduce((a, b) => a + b, 0),
    };
  });
  await page.mouse.up();
  expect(await node.evaluate((el) => el.view.x)).toBeLessThan(0);
  expect(errors).toEqual([]);
  await info.attach('canvas-pan-performance.json', {
    body: JSON.stringify(result, null, 2),
    contentType: 'application/json',
  });
  expect(result.draws.length).toBeGreaterThanOrEqual(50);
  expect(result.fps).toBeGreaterThan(30);
});

test.describe('idle network', () => {
  test.use({ reducedMotion: 'no-preference' });
  test('requests no frames while the settled network is idle', async ({
    page,
  }) => {
    await open(page);
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    );
    await page.clock.install();
    await page.evaluate(() => {
      const raf = window.requestAnimationFrame.bind(window);
      window.networkFrames = 0;
      window.requestAnimationFrame = (callback) => {
        window.networkFrames++;
        return raf(callback);
      };
    });
    await page.clock.runFor(1000);
    expect(await page.evaluate(() => window.networkFrames)).toBe(0);
  });
});
