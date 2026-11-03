/**
 * app-shell kind: the navigation is a bottom bar up to 640px, a rail up
 * to 1023px and a drawer from 1024px; the breakpoints are data.
 */

import { describe, it, expect } from 'test-anywhere';
import { appShellMode, shellMode } from '@link-foundation/ui-components';
import { mountLayout, setViewport } from './helpers.js';

const SHELL = `(app: app-shell (label Main)
  (bottom-bar tabs)
  (rail nav)
  (drawer nav)
  (tabs: stack (home: button 'Home'))
  (nav: stack (direction vertical) (go: button 'Go'))
  (main: stack (t: text 'Content')))`;

/** The shown navigation child, and whether the others are hidden. */
function slots(page) {
  return {
    mode: page.node('app').getAttribute('mode'),
    tabs: page.node('tabs').hidden,
    nav: page.node('nav').hidden,
    landmark: page.node('app').querySelector('[role=navigation]')?.dataset
      .linkId,
  };
}

describe('shellMode', () => {
  it('follows the default breakpoints 640 and 1024', () => {
    expect(shellMode(320)).toBe('bottom-bar');
    expect(shellMode(640)).toBe('bottom-bar');
    expect(shellMode(641)).toBe('rail');
    expect(shellMode(1023)).toBe('rail');
    expect(shellMode(1024)).toBe('drawer');
  });

  it('takes the breakpoints as data', () => {
    expect(shellMode(700, [720, 1200])).toBe('bottom-bar');
    expect(shellMode(1100, [720, 1200])).toBe('rail');
  });
});

describe('app-shell kind', () => {
  for (const [width, mode, landmark] of [
    [600, 'bottom-bar', 'tabs'],
    [800, 'rail', 'nav'],
    [1280, 'drawer', 'nav'],
  ]) {
    it(`shows the ${mode} at ${width}px`, async () => {
      const page = await mountLayout(SHELL, { width });
      expect(slots(page)).toEqual({
        mode,
        tabs: landmark !== 'tabs',
        nav: landmark !== 'nav',
        landmark,
      });
      const nav = page.node(landmark);
      expect(nav.getAttribute('aria-label')).toBe('Main');
      expect(page.node('main').hidden).toBe(false);
      expect(page.node('main').getAttribute('data-slot')).toBe('content');
      expect(page.diagnostics).toEqual([]);
      page.close();
    });
  }

  it('changes the mode when the viewport is resized', async () => {
    const page = await mountLayout(SHELL, { width: 1280 });
    const modes = [];
    page
      .node('app')
      .addEventListener('shell-mode', (e) => modes.push(e.detail.mode));
    for (const width of [800, 600, 600, 1280]) {
      setViewport(page.window, width);
      page.window.dispatchEvent(new page.window.Event('resize'));
    }
    expect(modes).toEqual(['rail', 'bottom-bar', 'drawer']);
    expect(appShellMode(page.node('app'))).toBe('drawer');
    page.close();
  });

  it('uses (breakpoints ...) from the document', async () => {
    const page = await mountLayout(
      SHELL.replace('(label Main)', '(label Main) (breakpoints 720 1200)'),
      { width: 1100 }
    );
    expect(appShellMode(page.node('app'))).toBe('rail');
    page.close();
  });
});
