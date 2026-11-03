/**
 * dock kind: panels in the regions left, right, top, bottom and center.
 * A panel moves to another region, floats, closes and comes back; Ctrl+F6
 * cycles the panels; the layout is saved and read back.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  dockLayout,
  dockLayoutFromLinks,
} from '@link-foundation/ui-components';
import { memoryStorage, mountLayout, press, tabTitles } from './helpers.js';

const DESIGNER = `designer: dock
  label Designer
  persist designer.layout
  left: region
    size 14rem
    panels toolbox outline
  right: region
    size 16rem
    panels properties
  center: region
    panels canvas
  toolbox: panel
    title Toolbox
    t: text 'Tools'
  outline: panel
    title Outline
    o: text 'Tree'
  properties: panel
    title Properties
    p: button 'Apply'
  canvas: panel
    title Canvas
    closable false
    c: text 'Canvas'
`;

const regionOf = (dock, side) =>
  dock.querySelector(`.ui-dock-region[data-side=${side}]`);

/** The tab titles of every shown region, by side. */
function regions(dock) {
  const shown = {};
  for (const region of dock.querySelectorAll('.ui-dock-region')) {
    if (!region.hidden) {
      shown[region.dataset.side] = tabTitles(region);
    }
  }
  return shown;
}

/** Choose an item of a menu button. */
function choose(page, button, label) {
  button.click();
  const item = [...page.document.querySelectorAll('[role=menuitem]')].find(
    (i) => i.textContent === label
  );
  if (item === undefined) {
    throw new Error(`no menu item ${label}`);
  }
  item.click();
}

/** Choose a panel action of a region for its shown panel. */
function act(page, side, panel, label) {
  const region = regionOf(page.node('designer'), side);
  region.querySelector(`[role=tab][data-panel=${panel}]`).click();
  choose(page, region.querySelector('.ui-tab-actions'), label);
}

describe('dock kind', () => {
  it('renders the regions as labelled groups with their tabs', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    expect(regions(dock)).toEqual({
      left: ['Toolbox', 'Outline'],
      right: ['Properties'],
      center: ['Canvas'],
    });
    const left = regionOf(dock, 'left');
    expect(left.getAttribute('role')).toBe('group');
    expect(left.getAttribute('aria-label')).toBe('Left panels');
    expect(dock.style.gridTemplateColumns).toBe(
      '14rem minmax(var(--ui-dock-center-min-width, 12rem), 1fr) 16rem'
    );
    expect(page.node('toolbox').hidden).toBe(false);
    expect(page.node('outline').hidden).toBe(true);
    expect(dock.querySelector('.ui-dock-restore').hidden).toBe(true);
    expect(page.diagnostics).toEqual([]);
    page.close();
  });

  it('moves a panel to another region and saves the layout', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    const changes = [];
    dock.addEventListener('dock-change', (e) => changes.push(e.detail));
    act(page, 'left', 'outline', 'Move to right');
    expect(regions(dock)).toEqual({
      left: ['Toolbox'],
      right: ['Properties', 'Outline'],
      center: ['Canvas'],
    });
    expect(page.document.activeElement.dataset.panel).toBe('outline');
    expect(page.node('outline').hidden).toBe(false);
    expect(page.node('properties').hidden).toBe(true);
    const saved = page.storage.map.get('designer.layout');
    expect(changes.at(-1).lino).toBe(saved);
    expect(dockLayoutFromLinks(saved)).toEqual(dockLayout(dock));
    page.close();
  });

  it('reads a saved layout back when it is rendered again', async () => {
    const storage = memoryStorage();
    const first = await mountLayout(DESIGNER, { storage });
    act(first, 'left', 'outline', 'Move to right');
    const saved = dockLayout(first.node('designer'));
    first.close();
    const second = await mountLayout(DESIGNER, { storage });
    expect(dockLayout(second.node('designer'))).toEqual(saved);
    expect(regions(second.node('designer')).right).toEqual([
      'Properties',
      'Outline',
    ]);
    second.close();
  });

  it('ignores a saved layout that does not parse', async () => {
    const storage = memoryStorage({ 'designer.layout': '(((' });
    const page = await mountLayout(DESIGNER, { storage });
    expect(regions(page.node('designer')).left).toEqual(['Toolbox', 'Outline']);
    page.close();
  });

  it('floats a panel in a window and docks it back', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    act(page, 'right', 'properties', 'Float');
    expect(regionOf(dock, 'right').hidden).toBe(true);
    expect(dock.style.gridTemplateColumns).toBe(
      '14rem minmax(var(--ui-dock-center-min-width, 12rem), 1fr) auto'
    );
    const float = dock.querySelector('.ui-dock-float');
    expect(float.getAttribute('role')).toBe('dialog');
    expect(float.contains(page.node('properties'))).toBe(true);
    expect(float.querySelector('.ui-window-title').textContent).toBe(
      'Properties'
    );
    expect(page.document.activeElement).toBe(float);
    const [floating] = dockLayout(dock).floating;
    expect([floating.panel, floating.region]).toEqual(['properties', 'right']);
    press(float, 'ArrowRight', { altKey: true });
    expect(dockLayout(dock).floating[0].x).toBe(floating.x + 16);
    float.querySelector('[aria-label="Dock Properties"]').click();
    expect(regions(dock).right).toEqual(['Properties']);
    expect(dock.querySelector('.ui-dock-float')).toBe(null);
    page.close();
  });
});

describe('dock kind: closing, collapsing and keys', () => {
  it('closes a panel and restores it from the "Restore panel" menu', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    const toolbox = regionOf(dock, 'left').querySelector(
      '[role=tab][data-panel=toolbox]'
    );
    press(toolbox, 'Delete');
    expect(regions(dock).left).toEqual(['Outline']);
    expect(page.document.activeElement.dataset.panel).toBe('outline');
    const restore = dock.querySelector('.ui-dock-restore');
    expect(restore.hidden).toBe(false);
    choose(page, restore, 'Toolbox');
    expect(regions(dock).left).toEqual(['Outline', 'Toolbox']);
    expect(page.document.activeElement.dataset.panel).toBe('toolbox');
    expect(restore.hidden).toBe(true);
    page.close();
  });

  it('closes a floating panel with Escape', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    act(page, 'left', 'outline', 'Float');
    press(dock.querySelector('.ui-dock-float'), 'Escape');
    expect(dockLayout(dock).closed.map((c) => c.panel)).toEqual(['outline']);
    expect(page.document.activeElement).toBe(
      dock.querySelector('.ui-dock-restore')
    );
    page.close();
  });

  it('does not close a panel with (closable false)', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    const canvas = regionOf(dock, 'center').querySelector('[role=tab]');
    expect(canvas.querySelector('.ui-tab-close')).toBe(null);
    press(canvas, 'Delete');
    expect(regions(dock).center).toEqual(['Canvas']);
    regionOf(dock, 'center').querySelector('.ui-tab-actions').click();
    const close = [...page.document.querySelectorAll('[role=menuitem]')].find(
      (i) => i.textContent === 'Close'
    );
    expect(close.getAttribute('aria-disabled')).toBe('true');
    close.click();
    expect(regions(dock).center).toEqual(['Canvas']);
    page.close();
  });

  it('collapses and expands a region', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    act(page, 'left', 'toolbox', 'Collapse region');
    expect(regionOf(dock, 'left').hasAttribute('data-collapsed')).toBe(true);
    expect(page.node('toolbox').hidden).toBe(true);
    expect(dock.style.gridTemplateColumns).toBe(
      'auto minmax(var(--ui-dock-center-min-width, 12rem), 1fr) 16rem'
    );
    act(page, 'left', 'toolbox', 'Expand region');
    expect(page.node('toolbox').hidden).toBe(false);
    page.close();
  });

  it('cycles the panels with Ctrl+F6 and Ctrl+Shift+F6', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    const focused = () => page.document.activeElement.dataset.panel;
    const toolbox = regionOf(dock, 'left').querySelector('[role=tab]');
    toolbox.focus();
    press(toolbox, 'F6', { ctrlKey: true });
    expect(focused()).toBe('outline');
    expect(page.node('outline').hidden).toBe(false);
    press(page.document.activeElement, 'F6', { ctrlKey: true });
    expect(focused()).toBe('properties');
    press(page.document.activeElement, 'F6', { ctrlKey: true });
    expect(focused()).toBe('canvas');
    press(page.document.activeElement, 'F6', { ctrlKey: true });
    expect(focused()).toBe('toolbox');
    press(page.document.activeElement, 'F6', { ctrlKey: true, shiftKey: true });
    expect(focused()).toBe('canvas');
    // From a control inside a panel too.
    const apply = page.node('p').querySelector('button');
    regionOf(dock, 'right').querySelector('[role=tab]').click();
    apply.focus();
    press(apply, 'F6', { ctrlKey: true });
    expect(focused()).toBe('canvas');
    page.close();
  });

  it('moves a tab dragged to another region', async () => {
    const page = await mountLayout(DESIGNER);
    const dock = page.node('designer');
    const { Event } = page.window;
    const tab = regionOf(dock, 'left').querySelector('[data-panel=outline]');
    tab.dispatchEvent(new Event('dragstart', { bubbles: true }));
    const target = regionOf(dock, 'center').querySelector('[role=tablist]');
    target.dispatchEvent(
      new Event('drop', { bubbles: true, cancelable: true })
    );
    expect(regions(dock)).toEqual({
      left: ['Toolbox'],
      right: ['Properties'],
      center: ['Canvas', 'Outline'],
    });
    page.close();
  });

  it('puts a panel that no region lists in the center', async () => {
    const page = await mountLayout(
      DESIGNER.replace(
        '  canvas: panel',
        "  console: panel\n    title Console\n    k: text 'Log'\n  canvas: panel"
      )
    );
    expect(regions(page.node('designer')).center).toEqual([
      'Canvas',
      'Console',
    ]);
    page.close();
  });
});
