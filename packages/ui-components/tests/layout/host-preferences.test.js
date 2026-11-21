import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import { createPrefSwitches } from '../../src/layout/index.js';

test('binary preferences override the effective system values through the original target', () => {
  const dom = new JSDOM('<body></body>');
  const { window } = dom;
  window.matchMedia = () =>
    Object.assign(new window.EventTarget(), { matches: true });
  let saved = { locale: 'en', 'motion.mode': 'auto', 'theme.mode': 'system' };
  const target = {
    values: () => saved,
    update: (patch) => {
      saved = { ...saved, ...patch };
    },
  };
  const options = {
    document: window.document,
    target,
    motionBehavior: 'toggle',
    themeBehavior: 'toggle',
    languages: [
      { locale: 'en', label: 'English' },
      { locale: 'ru', label: 'Русский' },
    ],
    message: (key, { next }) =>
      key === 'motion' ? `${saved.locale} motion ${next}` : undefined,
    renderButton: ({ kind }) => {
      const svg = window.document.createElementNS(
        'http://www.w3.org/2000/svg',
        'svg'
      );
      svg.dataset.icon = kind;
      return svg;
    },
    tooltip: ({ label }) => label,
  };
  const switches = createPrefSwitches(options);
  const motion =
    switches.element.querySelector('[data-icon=motion]').parentElement;
  const theme =
    switches.element.querySelector('[data-icon=theme]').parentElement;
  assert.equal(motion.getAttribute('aria-pressed'), 'false');
  assert.equal(motion.title, 'en motion on');
  motion.click();
  theme.click();
  assert.equal(saved['motion.mode'], 'on');
  assert.equal(saved['theme.mode'], 'light');
  switches.element.querySelector('[lang=ru]').parentElement.click();
  assert.equal(motion.title, 'ru motion off');
  motion.click();
  switches.destroy();
  const restored = createPrefSwitches(options);
  assert.equal(
    restored.element.querySelector('[data-icon=motion]').parentElement.title,
    'ru motion on'
  );
  restored.destroy();
  dom.window.close();
});
