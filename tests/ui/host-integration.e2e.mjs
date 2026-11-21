import { test, expect } from '@playwright/test';
import { expectAccessible } from './helpers.mjs';

const example = '/examples/themes/host-integration/';

test('restores host stars, shader clock and a shared grid phase while paused', async ({
  page,
  browserName,
}) => {
  await page.goto(example);
  await page.waitForFunction(() => Boolean(window.hostScene));
  const restored = await page.evaluate(() => {
    const canvas = (id) => document.getElementById(id);
    const stars = canvas('stars').toDataURL();
    const sky = canvas('sky');
    const gl = sky.getContext('webgl');
    const grid = document.querySelector('#grid > div');
    const css = () => window.getComputedStyle(grid);
    const pixels = (id) => canvas(id).getContext('2d');
    const alpha = (ctx, x, y) => ctx.getImageData(x, y, 1, 1).data[3];
    const shift = () => new window.DOMMatrixReadOnly(css().transform).m42;
    const savedSky = gl && sky.toDataURL();
    window.hostScene.seek(4799);
    const end = shift();
    window.hostScene.seek(4800);
    const start = shift();
    const changed = !gl || sky.toDataURL() !== savedSky;
    // In the fixture the first horizontal beam sits on 8 + 48*n at rollover.
    const beam = pixels('beams');
    const alignedBeam = Array.from(
      { length: beam.canvas.height },
      (_, row) => row
    ).some(
      (y) =>
        y % 48 === 8 &&
        beam
          .getImageData(0, y, beam.canvas.width, 1)
          .data.some((a, i) => i % 4 === 3 && a > 0)
    );
    // Rain uses half cells and the same origin. Custom glyphs start below each origin.
    const rain = pixels('rain');
    const rainCell = Array.from(
      { length: Math.floor((rain.canvas.width - 9) / 24) },
      (_, i) => i
    ).some((i) => {
      for (let y = 8; y < rain.canvas.height - 24; y += 24) {
        if (alpha(rain, i * 24 + 9 + 6, y + 12)) {
          return true;
        }
      }
      return false;
    });
    const still = [2680, 4799].map((ms) => {
      window.hostScene.seek(ms);
      return [canvas('beams').toDataURL(), canvas('rain').toDataURL(), shift()];
    });
    const before = [css().backgroundColor, css().opacity];
    window.hostScene.seek(1800);
    grid.parentElement.style.setProperty('--host-grid-line', '#a1c4ef');
    grid.parentElement.style.setProperty('--host-grid-alpha', '0.2');
    return {
      starsMatch: stars === canvas('reference').toDataURL(),
      starsStay: stars === canvas('stars').toDataURL(),
      shader: Boolean(gl),
      changed,
      replayed: !gl || sky.toDataURL() === savedSky,
      end,
      start,
      alignedBeam,
      rainCell,
      stillChanged: still[0].every((value, i) => value !== still[1][i]),
      before,
      after: [css().backgroundColor, css().opacity],
      origin: css().maskPosition,
    };
  });
  if (browserName === 'chromium') {
    expect(restored.shader).toBe(true);
  }
  expect(restored).toMatchObject({
    starsMatch: true,
    starsStay: true,
    changed: true,
    replayed: true,
    start: 0,
    alignedBeam: true,
    rainCell: true,
    stillChanged: true,
    before: ['rgb(143, 174, 255)', '0.36'],
    after: ['rgb(161, 196, 239)', '0.15'],
    origin: '-15px -16px',
  });
  expect(restored.end).toBeCloseTo(47.99, 2);
});

test('skin and inherited levels paint host pseudo-elements with intrinsic fit', async ({
  page,
}) => {
  await page.goto(example);
  await page.waitForFunction(() => Boolean(window.hostScene));
  const panel = page.locator('[data-level="panel"]');
  const nested = page.locator('[data-level="block"]');
  const placement = (locator) =>
    locator.evaluate((element) => {
      const surface = element.firstElementChild;
      const material = window.getComputedStyle(surface, '::before');
      const top = window.getComputedStyle(surface, '::after');
      return {
        width: element.offsetWidth,
        contentWidth: element.lastElementChild.offsetWidth,
        fit: Number(material.getPropertyValue('--host-frame-g-fit')),
        start: Number.parseFloat(
          top.getPropertyValue('--host-frame-edge-top-0-0')
        ),
        corner: top.getPropertyValue('--host-frame-g-tl-w').trim(),
        oppositeCorner: top.getPropertyValue('--host-frame-g-tr-w').trim(),
        material: material.backgroundImage,
        clip: material.clipPath,
        filter: material.backdropFilter,
        stroke: top.opacity,
        content: window.getComputedStyle(element.lastElementChild).opacity,
      };
    });
  const wide = await placement(panel);
  expect(wide.width).toBe(wide.contentWidth);
  expect(wide).toMatchObject({
    fit: 1,
    start: 75,
    corner: '58px',
    oppositeCorner: '42px',
    filter: 'blur(5px)',
    stroke: '1',
    content: '1',
  });
  expect(wide.clip).toContain('polygon(');
  expect(wide.material).toContain('repeating-linear-gradient(');
  const block = await placement(nested);
  expect(block.corner).toBe('26.1px');
  expect(block.oppositeCorner).toBe('28px');
  expect(block.start).toBeCloseTo(41.1);
  const startInset = '--host-frame-panel-top-inset-start';
  await panel.evaluate(
    (element, key) => element.style.setProperty(key, '17px'),
    startInset
  );
  const edited = await placement(panel);
  expect(edited.start).toBe(wide.start + 4);
  expect(edited.clip).toBe(wide.clip);
  await panel.evaluate(
    (element, key) => element.style.removeProperty(key),
    startInset
  );
  await expectAccessible(page);
  await page.setViewportSize({ width: 144, height: 820 });
  const narrow = await placement(panel);
  expect(narrow.width).toBe(narrow.contentWidth);
  expect(narrow.width).toBeLessThan(wide.width);
  expect(narrow.fit).toBeLessThan(1);
  expect(narrow.fit).toBeGreaterThan(0);
  expect(narrow.start).toBeLessThan(wide.start);
  await panel.evaluate((element) =>
    element.setAttribute('data-host-frame-panel-mode', 'border')
  );
  const border = await placement(panel);
  expect(border.start).toBe(4);
  expect(border.content).toBe('1');
  expect(border.stroke).toBe('1');
  await page.getByRole('button', { name: 'Reduce transparency' }).click();
  const reduced = await placement(panel);
  expect(reduced.filter).toBe('none');
  expect(reduced.material).toBe('none');
  expect(reduced.stroke).toBe(border.stroke);
  expect(reduced.content).toBe(border.content);
  expect(reduced.clip).toBe(border.clip);
});
