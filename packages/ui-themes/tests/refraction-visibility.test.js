import { it } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import {
  createRefractionProvider,
  observeMaterialVisibility,
  materialStyle,
  readMaterial,
} from '../src/classic/materials.js';

it('validates refraction parameters, uses one inert provider per document and orders filters', () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>');
  const doc = dom.window.document;
  Object.defineProperty(dom.window.navigator, 'userAgent', {
    value: 'Chrome/130.0',
  });
  dom.window.CSS = { supports: () => true };
  const provider = createRefractionProvider(doc);
  assert.equal(provider, createRefractionProvider(doc));
  assert.equal(doc.querySelectorAll('svg').length, 1);
  assert.equal(doc.querySelector('svg').getAttribute('aria-hidden'), 'true');
  const m = readMaterial(
    'm: material\n  refraction 0.5\n  blur 8\n  saturation 160\n  brightness 90\n  contrast 120'
  );
  assert.match(
    materialStyle(m, { refractionProvider: provider })['backdrop-filter'],
    /^url\("#.+"\) blur\(8px\) saturate\(160%\) brightness\(90%\) contrast\(120%\)$/u
  );
  assert.equal(
    doc.querySelector('feDisplacementMap').getAttribute('scale'),
    '20'
  );
  assert.equal(
    doc.querySelector('feTurbulence').getAttribute('baseFrequency'),
    '0.012'
  );
  assert.equal(provider.reference(1, { transparency: 'off' }), '');
  assert.equal(provider.reference(1, { reducedTransparency: true }), '');
  for (const [key, min, max] of [
    ['scale', 0, 150],
    ['detail', 2, 60],
    ['octaves', 1, 4],
    ['smoothing', 0, 10],
    ['seed', 0, 100],
  ]) {
    for (const value of [min - 1, max + 1, NaN]) {
      assert.throws(
        () => createRefractionProvider(doc, { [key]: value }),
        RangeError
      );
    }
  }
  const half = provider.reference(0.5);
  const full = provider.reference(1);
  assert.notEqual(half, full);
  assert.equal(provider.reference(0.5), half);
  assert.equal(
    doc.querySelector('feDisplacementMap').getAttribute('scale'),
    '20'
  );
  provider.dispose();
  assert.equal(provider.reference(1), '');
  assert.equal(doc.querySelectorAll('svg').length, 0);
  dom.window.close();
});

it('unsupported engines retain blur and reduced transparency auto disables references', () => {
  for (const userAgent of ['Firefox/140', 'Version/18 Safari/605']) {
    const dom = new JSDOM('<!doctype html>');
    Object.defineProperty(dom.window.navigator, 'userAgent', {
      value: userAgent,
    });
    const provider = createRefractionProvider(dom.window.document);
    assert.equal(provider.reference(1), '');
    provider.dispose();
    dom.window.close();
  }
  const dom = new JSDOM('<!doctype html>');
  Object.defineProperty(dom.window.navigator, 'userAgent', {
    value: 'Chrome/130',
  });
  dom.window.CSS = { supports: () => true };
  dom.window.matchMedia = () => ({ matches: true });
  const provider = createRefractionProvider(dom.window.document);
  assert.equal(provider.reference(1), '');
  assert.ok(provider.reference(1, { transparency: 'on' }));
  provider.dispose();
  dom.window.close();
});

it('without IntersectionObserver visibility observation is a no-op', () => {
  const dom = new JSDOM(
    '<!doctype html><div class="material" style="backdrop-filter:blur(2px)"></div>'
  );
  const before = dom.window.document.documentElement.outerHTML;
  observeMaterialVisibility(dom.window.document, '.material').dispose();
  assert.equal(dom.window.document.documentElement.outerHTML, before);
  dom.window.close();
});

it('releases visible removed elements even after their selector changes', async () => {
  const dom = new JSDOM('<!doctype html><div class="surface"></div>');
  const observed = new Set();
  let notify;
  dom.window.IntersectionObserver = class {
    constructor(callback) {
      notify = callback;
    }
    observe(element) {
      observed.add(element);
    }
    unobserve(element) {
      observed.delete(element);
    }
    disconnect() {
      observed.clear();
    }
  };
  const root = dom.window.document.body;
  const element = root.firstElementChild;
  const visibility = [];
  const budget = observeMaterialVisibility(root, '.surface', {
    onVisibility: (_, visible) => visibility.push(visible),
  });
  notify([{ target: element, isIntersecting: true }]);
  assert.deepEqual(visibility, [true]);
  element.className = 'renamed';
  element.remove();
  await new Promise((resolve) => dom.window.queueMicrotask(resolve));
  assert.equal(observed.size, 0);
  budget.dispose();
  assert.equal(root.querySelectorAll('style').length, 0);
  dom.window.close();
});
