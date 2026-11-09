import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';
import { test, expect } from '@playwright/test';
import {
  readFrames,
  resolveFrame,
  frameGeometry,
  framesCss,
  frameLayers,
  corners,
  lines,
} from '../../src/classic/frames.js';
import {
  FRAME_CORNERS,
  FRAME_EDGES,
  FRAME_STYLES,
} from '../../src/classic/frame-schema.js';
import AxeBuilder from '@axe-core/playwright';

const source = `frames
  panel
    corner top-left cut
      size 60
      width 40
      stroke 2
      color '#71e3ff'
    corner top-right round
      size 20
    corner bottom-right scoop
      size 18
    corner bottom-left notch
      size 30
    edge top bracket
      stroke 3
      gap 24
    state hover
      opacity 0.8
    state active
      opacity 0.6
    state selected
      opacity 0.4
    state focus
      opacity 0.2
  block
    extends panel
      scale 0.6
`;
const frames = readFrames(source);
const layer = frameLayers();
function documentHtml(css, content) {
  return `<!doctype html><html lang="en"><head><title>Responsive frames</title><style>${css.properties}${css.base}${Object.values(css.levels).join('')}${css.fit}
header{height:60px} h1{margin:0} body{margin:16px;background:#112738;color:#fff;font:14px system-ui} [data-frame]{width:320px;height:200px;--frame-material:#345266} .content{margin:0;padding:12px} button{color:inherit;background:transparent;border:0} main{display:grid;gap:16px}</style></head><body><header><h1>Responsive frames</h1></header><main>${content}</main></body></html>`;
}
const clip = (page, selector = '[data-frame-material]') =>
  page
    .locator(selector)
    .first()
    .evaluate((el) => window.getComputedStyle(el).clipPath);

test('uniform responsive fitting agrees with fixed geometry at all requested sizes, without script', async ({
  page,
}) => {
  await page.setContent(
    documentHtml(
      framesCss(frames),
      `<article data-frame="panel">${layer}<p class="content">Responsive frame</p></article>`
    )
  );
  for (const [width, height] of [
    [320, 200],
    [80, 24],
    [1200, 40],
    [1, 1],
  ]) {
    await page.locator('article').evaluate(
      (el, [w, h]) => {
        el.style.width = `${w}px`;
        el.style.height = `${h}px`;
      },
      [width, height]
    );
    const points = (await clip(page))
      .match(/-?\d+(?:\.\d+)?px/gu)
      .map(parseFloat);
    const reference = frameGeometry(
      resolveFrame(frames, 'panel'),
      width,
      height
    );
    const tl = reference.corners['top-left'];
    const tr = reference.corners['top-right'];
    expect(points[0]).toBeCloseTo(0, 4);
    expect(points[1]).toBeCloseTo(tl.height, 3);
    expect(points[32]).toBeCloseTo(tl.width, 3);
    expect(points[34]).toBeCloseTo(width - tr.width, 2);
    expect(tl.width + tr.width).toBeLessThanOrEqual(width + 0.00001);
  }
  await page.locator('html').evaluate((el) => {
    for (const name of [
      'top-left',
      'top-right',
      'bottom-right',
      'bottom-left',
    ]) {
      el.setAttribute(`data-frame-panel-${name}-line`, 'gap');
    }
    for (const id of ['tl', 'tr', 'br', 'bl']) {
      el.style.setProperty(`--frame-panel-${id}-arm`, '128px');
    }
  });
  const bands = await page
    .locator('[data-frame-edge]')
    .evaluateAll((elements) =>
      elements.map((el) =>
        window
          .getComputedStyle(el)
          .clipPath.match(/-?\d+(?:\.\d+)?px/gu)
          .map(parseFloat)
      )
    );
  bands.forEach((points, i) => {
    const axis = i % 2;
    expect(points[axis]).toBeLessThanOrEqual(points[axis + 2] + 0.00001);
  });
});
test('live size, independent shape, inheritance and property-registration fallback', async ({
  page,
}) => {
  const css = framesCss(frames);
  const content = `<article data-frame="panel">${layer}<p class="content">Outer</p></article><article data-frame="block">${layer}<p class="content">Block</p></article>`;
  await page.setContent(documentHtml(css, content));
  const before = await clip(page);
  await page.locator('html').evaluate((el) => {
    el.style.setProperty('--frame-panel-tl-width', '100px');
    el.setAttribute('data-frame-panel-top-left-shape', 'scoop');
  });
  const changed = await clip(page);
  expect(changed).not.toBe(before);
  const blockClip = await clip(
    page,
    '[data-frame="block"] [data-frame-material]'
  );
  expect(blockClip).toContain('60px');
  await expect(page.locator('main')).toHaveScreenshot('property-fallback.png');
  await page.locator('style').evaluate((el) => {
    el.textContent = el.textContent.replace(/@property [^{]+\{[^}]+\}/gu, '');
  });
  await expect(page.locator('main')).toHaveScreenshot('property-fallback.png');
  const coordinates = (text) =>
    text.match(/-?\d+(?:\.\d+)?px/gu).map(parseFloat);
  for (const [selector, before] of [
    ['[data-frame="panel"] [data-frame-material]', changed],
    ['[data-frame="block"] [data-frame-material]', blockClip],
  ]) {
    const after = coordinates(await clip(page, selector));
    coordinates(before).forEach((value, i) =>
      expect(after[i]).toBeCloseTo(value, 2)
    );
  }
});
test('states have fixed precedence, disabled excludes hover, and selection is configurable', async ({
  page,
}) => {
  await page.setContent(
    documentHtml(
      framesCss(
        readFrames(
          source.replace(
            'state hover\n      opacity 0.8',
            `state hover
      opacity 0.8
      edge top bracket
        style double
      corner bottom-left cut
        stroke 3`
          )
        ),
        { selected: ['[data-selected]'] }
      ),
      `<button data-frame="panel">${layer}<span class="content">Select</span></button>`
    )
  );
  const button = page.locator('button');
  const opacity = () =>
    page
      .locator('[data-frame-corner="tl"]')
      .evaluate((el) => window.getComputedStyle(el).opacity);
  await button.hover();
  expect(await opacity()).toBe('0.8');
  await page.mouse.down();
  expect(await opacity()).toBe('0.6');
  expect(
    await page
      .locator('[data-frame-edge="top"]')
      .evaluate((el) => window.getComputedStyle(el).backgroundImage)
  ).toContain('66.667%');
  expect(
    await page
      .locator('[data-frame-corner="bl"]')
      .evaluate((el) =>
        window.getComputedStyle(el).getPropertyValue('--frame-g-bl-stroke')
      )
  ).toBe('3px');
  await button.evaluate((el) => el.setAttribute('data-selected', ''));
  expect(await opacity()).toBe('0.4');
  await page.mouse.up();
  await button.evaluate((el) => el.blur());
  await page.keyboard.press('Tab');
  expect(await opacity()).toBe('0.2');
  await button.evaluate((el) => {
    el.blur();
    el.removeAttribute('data-selected');
    el.disabled = true;
  });
  expect(await opacity()).toBe('1');
});
for (const [styleIndex, style] of FRAME_STYLES.entries()) {
  test(`all shape/line combinations with ${style} edges are independently drawable, transparent and accessible`, async ({
    page,
  }) => {
    const matrixFrames = readFrames(
      `frames\n  panel\n${FRAME_CORNERS.map((name) => `    corner ${name} cut\n      size 12\n      stroke 2\n      color '#71e3ff'`).join('\n')}\n${FRAME_EDGES.map((side) => `    edge ${side} line\n      stroke 2\n      color '#71e3ff'`).join('\n')}`
    );
    const css = framesCss(matrixFrames, { scope: '.scope' });
    const cards = corners
      .flatMap((shape) =>
        lines.map((line) => {
          const attrs = FRAME_CORNERS.flatMap((name) => [
            `data-frame-panel-${name}-shape="${shape}"`,
            `data-frame-panel-${name}-line="${line}"`,
          ]).join(' ');
          const styles = FRAME_EDGES.map(
            (side, i) =>
              `data-frame-panel-${side}-style="${FRAME_STYLES[(i + styleIndex) % FRAME_STYLES.length]}" data-frame-panel-${side}-line="${line}"`
          ).join(' ');
          return `<section class="scope" ${attrs} ${styles}><article data-frame="panel">${layer}<span class="content">${shape} ${line} ${style}</span></article></section>`;
        })
      )
      .join('');
    await page.setContent(
      documentHtml(css, cards).replace(
        '</style>',
        'main{grid-template-columns:repeat(7,1fr);gap:10px} [data-frame]{width:110px;height:48px}.content{display:block;padding:14px 8px;font-size:9px}</style>'
      )
    );
    expect(await page.locator('[data-frame-corner]').count()).toBe(140);
    const invalid = await page
      .locator('[data-frame-corner]')
      .evaluateAll(
        (elements) =>
          elements.filter(
            (el) => window.getComputedStyle(el).clipPath === 'none'
          ).length
      );
    expect(invalid).toBe(0);
    expect(
      await page
        .locator('.content')
        .first()
        .evaluate((el) => window.getComputedStyle(el).opacity)
    ).toBe('1');
    await expect(page.locator('main')).toHaveScreenshot(
      `frame-matrix-${style}.png`
    );
    const audit = await new AxeBuilder({ page }).analyze();
    expect(audit.violations).toEqual([]);
  });
}

test('nested blocks restart at boundaries and all levels support live frame, own and border modes', async ({
  page,
}) => {
  const levels = [
    'panel',
    'block',
    'control',
    'button',
    'field',
    'tab',
    'chip',
    'menu',
    'nav',
    'subnav',
    'table',
  ];
  const definitions = readFrames(
    `frames\n  panel\n    corner top-left cut\n      size 40\n${levels
      .slice(1)
      .map(
        (level) =>
          `  ${level}\n    extends panel\n      scale 0.6\n    corner top-left cut\n      size 12`
      )
      .join('\n')}`
  );
  const css = framesCss(definitions, { boundaryAttribute: 'data-boundary' });
  const host = (id, content = '') =>
    `<article id="${id}" data-frame="panel">${layer}${content}</article>`;
  await page.setContent(
    documentHtml(
      css,
      host('outer', host('nested')) +
        host(
          'wrapper',
          `<section data-boundary>${host('preview', host('preview-nested'))}</section>`
        ) +
        levels
          .slice(1)
          .map((level) => `<article data-frame="${level}">${layer}</article>`)
          .join('')
    )
  );
  const extent = (selector) =>
    page
      .locator(`${selector} > [data-frame-surface] > *`)
      .evaluate((el) =>
        parseFloat(
          window.getComputedStyle(el).clipPath.split(',')[0].split(' ').at(-1)
        )
      );
  expect(await extent('#outer')).toBe(40);
  expect(await extent('#nested')).toBe(12);
  expect(await extent('#preview')).toBe(40);
  expect(await extent('#preview-nested')).toBe(12);
  for (const level of levels.slice(1)) {
    const selector = `[data-frame="${level}"]`;
    expect(await extent(selector)).toBe(12);
    await page
      .locator('html')
      .evaluate(
        (el, level) => el.setAttribute(`data-frame-${level}-mode`, 'frame'),
        level
      );
    expect(await extent(selector)).toBe(24);
    await page
      .locator('html')
      .evaluate(
        (el, level) => el.setAttribute(`data-frame-${level}-mode`, 'border'),
        level
      );
    expect(await extent(selector)).toBe(0);
    await page
      .locator('html')
      .evaluate(
        (el, level) => el.setAttribute(`data-frame-${level}-mode`, 'own'),
        level
      );
    expect(await extent(selector)).toBe(12);
  }
  await page
    .locator('html')
    .evaluate((el) => el.style.setProperty('--frame-control-scale', '0.5'));
  await page
    .locator('html')
    .evaluate((el) => el.setAttribute('data-frame-control-mode', 'frame'));
  expect(await extent('[data-frame="control"]')).toBe(20);
});

test('threshold fitting scales corners, restores a rectangle, and layers leave content opaque', async ({
  page,
}) => {
  await page.goto('/tests/ui/pages/smoke.html');
  const css = framesCss(frames);
  await page.setContent(
    documentHtml(
      css,
      `<article data-frame="panel">${layer}<span class="content">Content remains opaque</span></article>`
    )
  );
  // Import the public helper through the repository's static module server.
  await page.addScriptTag({
    type: 'module',
    content: `import { observeFrameFit } from 'http://127.0.0.1:4173/packages/ui-dom/src/frame-fit.js'; window.fit = observeFrameFit(document, { levels: { panel: ["[data-frame='panel']"] } });`,
  });
  await page.waitForFunction(() => window.fit);
  await page
    .locator('html')
    .evaluate((el) => el.style.setProperty('--frame-panel-min-width', '400'));
  await expect(page.locator('article')).toHaveAttribute(
    'data-frame-fit',
    'outside'
  );
  const y = () =>
    page
      .locator('[data-frame-material]')
      .evaluate((el) =>
        parseFloat(
          window.getComputedStyle(el).clipPath.split(',')[0].split(' ').at(-1)
        )
      );
  expect(await y()).toBe(30);
  await page
    .locator('html')
    .evaluate((el) => el.style.setProperty('--frame-panel-fitScale', '0'));
  expect(await y()).toBe(0);
  expect(
    await page
      .locator('[data-frame-corner="tl"]')
      .evaluate((el) => window.getComputedStyle(el).opacity)
  ).toBe('0');
  await page.locator('html').evaluate((el) => {
    el.setAttribute('data-frame-panel-layer', 'below');
    el.style.setProperty('--frame-panel-opacity', '0.3');
  });
  expect(
    await page
      .locator('[data-frame-strokes]')
      .evaluate((el) => window.getComputedStyle(el).zIndex)
  ).toBe('0');
  expect(
    await page
      .locator('.content')
      .evaluate((el) => window.getComputedStyle(el).opacity)
  ).toBe('1');
  await page
    .locator('html')
    .evaluate((el) => el.setAttribute('data-frame-panel-layer', 'above'));
  expect(
    await page
      .locator('[data-frame-strokes]')
      .evaluate((el) => window.getComputedStyle(el).zIndex)
  ).toBe('2');
  await page.evaluate(() => window.fit.dispose());
  await expect(page.locator('article')).not.toHaveAttribute('data-frame-fit');
});

test('spec CSS matches fresh SVG contour and independent strokes at the reference sizes', async ({
  page,
}) => {
  const input = await readFile(
    new URL(
      '../../../../examples/themes/responsive-frames/frames.lino',
      import.meta.url
    ),
    'utf8'
  );
  const spec = readFrames(input);
  for (const [width, height] of [
    [320, 200],
    [80, 24],
    [1200, 40],
  ]) {
    await page.setContent(
      documentHtml(
        framesCss(spec),
        `<article data-frame="panel" style="width:${width}px;height:${height}px">${layer}</article>`
      )
    );
    const name = `reference-${width}-${height}.png`;
    await expect(page.locator('article')).toHaveScreenshot(name, {
      maxDiffPixelRatio: 0.01,
    });
    const reference = frameGeometry(resolveFrame(spec, 'panel'), width, height);
    await page.locator('article').evaluate((el, geometry) => {
      const material = document.createElement('span');
      material.style.cssText = 'position:absolute;inset:0;background:#345266';
      material.style.clipPath = geometry.clipPath;
      el.innerHTML = geometry.borderSvg;
      el.querySelector('svg').style.cssText =
        'position:absolute;inset:0;overflow:visible';
      el.prepend(material);
    }, reference);
    await expect(page.locator('article')).toHaveScreenshot(name, {
      maxDiffPixelRatio: 0.01,
    });
  }
});
