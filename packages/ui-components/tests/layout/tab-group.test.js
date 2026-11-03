/**
 * tab-group kind: WAI-ARIA APG tabs (automatic activation). The arrows,
 * Home and End select, Delete closes a closable tab, Ctrl+Shift+Arrow
 * reorders, and the "More tabs" menu lists the tabs when they overflow.
 */

import { describe, it, expect } from 'test-anywhere';
import { activeTab } from '@link-foundation/ui-components';
import { mountLayout, press, tabTitles } from './helpers.js';

const TABS = `(inspector: tab-group (label Inspector)
  (styles: panel (title Styles) (s: text 'Styles'))
  (events: panel (title Events) (closable true) (e: text 'Events'))
  (data: panel (title Data) (closable true) (d: text 'Data')))`;

const tabsOf = (node) => [...node.querySelectorAll('[role=tab]')];

/** Collect the events of a node by type. */
function record(node, types) {
  const seen = [];
  for (const type of types) {
    node.addEventListener(type, (e) => seen.push([type, e.detail]));
  }
  return seen;
}

describe('tab-group kind', () => {
  it('renders a tablist with one tab and one tabpanel per panel', async () => {
    const page = await mountLayout(TABS);
    const group = page.node('inspector');
    const list = group.querySelector('[role=tablist]');
    expect(list.getAttribute('aria-label')).toBe('Inspector');
    expect(tabTitles(group)).toEqual(['Styles', 'Events', 'Data']);
    const [first, second] = tabsOf(group);
    expect(first.getAttribute('aria-selected')).toBe('true');
    expect(first.tabIndex).toBe(0);
    expect(second.tabIndex).toBe(-1);
    const panel = page.node('styles');
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(first.getAttribute('aria-controls')).toBe(panel.id);
    expect(panel.getAttribute('aria-labelledby')).toBe(first.id);
    expect(page.node('events').hidden).toBe(true);
    expect(first.querySelector('.ui-tab-close')).toBe(null);
    expect(second.querySelector('.ui-tab-close')).not.toBe(null);
    expect(page.diagnostics).toEqual([]);
    page.close();
  });

  it('selects with the arrows, Home and End and moves the focus', async () => {
    const page = await mountLayout(TABS);
    const group = page.node('inspector');
    const seen = record(group, ['tab-change']);
    const [first] = tabsOf(group);
    first.focus();
    press(first, 'ArrowRight');
    expect(activeTab(group)).toBe('events');
    expect(page.document.activeElement.dataset.panel).toBe('events');
    expect(page.node('events').hidden).toBe(false);
    expect(page.node('styles').hidden).toBe(true);
    press(page.document.activeElement, 'End');
    expect(activeTab(group)).toBe('data');
    press(page.document.activeElement, 'ArrowRight');
    expect(activeTab(group)).toBe('styles');
    press(page.document.activeElement, 'ArrowLeft');
    press(page.document.activeElement, 'Home');
    expect(activeTab(group)).toBe('styles');
    expect(seen.map(([, d]) => d.active)).toEqual([
      'events',
      'data',
      'styles',
      'data',
      'styles',
    ]);
    page.close();
  });

  it('closes a closable tab with Delete and focuses the next one', async () => {
    const page = await mountLayout(TABS);
    const group = page.node('inspector');
    const seen = record(group, ['tab-close']);
    press(tabsOf(group)[0], 'Delete');
    expect(tabTitles(group)).toEqual(['Styles', 'Events', 'Data']);
    const events = tabsOf(group)[1];
    events.click();
    press(events, 'Delete');
    expect(tabTitles(group)).toEqual(['Styles', 'Data']);
    expect(activeTab(group)).toBe('data');
    expect(page.document.activeElement.dataset.panel).toBe('data');
    expect(page.node('events').hidden).toBe(true);
    expect(seen).toEqual([['tab-close', { panel: 'events' }]]);
    page.close();
  });

  it('closes a tab with its close mark', async () => {
    const page = await mountLayout(TABS);
    const group = page.node('inspector');
    tabsOf(group)[2].querySelector('.ui-tab-close').click();
    expect(tabTitles(group)).toEqual(['Styles', 'Events']);
    page.close();
  });

  it('reorders with Ctrl+Shift+Arrow and keeps the focus on the tab', async () => {
    const page = await mountLayout(TABS);
    const group = page.node('inspector');
    const seen = record(group, ['tab-reorder']);
    const first = tabsOf(group)[0];
    first.focus();
    press(first, 'ArrowRight', { ctrlKey: true, shiftKey: true });
    expect(tabTitles(group)).toEqual(['Events', 'Styles', 'Data']);
    expect(page.document.activeElement).toBe(first);
    press(first, 'ArrowRight', { ctrlKey: true, shiftKey: true });
    press(first, 'ArrowRight', { ctrlKey: true, shiftKey: true });
    expect(tabTitles(group)).toEqual(['Events', 'Data', 'Styles']);
    press(first, 'ArrowLeft', { ctrlKey: true, shiftKey: true });
    expect(tabTitles(group)).toEqual(['Events', 'Styles', 'Data']);
    expect(seen.at(-1)).toEqual([
      'tab-reorder',
      { order: ['events', 'styles', 'data'] },
    ]);
    expect(activeTab(group)).toBe('styles');
    page.close();
  });

  it('does not reorder with (reorderable false)', async () => {
    const page = await mountLayout(
      TABS.replace('(label Inspector)', '(label Inspector) (reorderable false)')
    );
    const group = page.node('inspector');
    press(tabsOf(group)[0], 'ArrowRight', { ctrlKey: true, shiftKey: true });
    expect(tabTitles(group)).toEqual(['Styles', 'Events', 'Data']);
    page.close();
  });

  it('starts on the panel named by (active ...)', async () => {
    const page = await mountLayout(
      TABS.replace('(label Inspector)', '(label Inspector) (active data)')
    );
    expect(activeTab(page.node('inspector'))).toBe('data');
    page.close();
  });

  it('shows the "More tabs" menu when the tabs overflow', async () => {
    const page = await mountLayout(TABS);
    const group = page.node('inspector');
    const list = group.querySelector('[role=tablist]');
    const more = group.querySelector('.ui-tab-overflow');
    expect(more.hidden).toBe(true);
    Object.defineProperty(list, 'scrollWidth', { value: 400 });
    Object.defineProperty(list, 'clientWidth', { value: 200 });
    tabsOf(group)[1].click();
    expect(more.hidden).toBe(false);
    expect(more.getAttribute('aria-haspopup')).toBe('menu');
    press(more, 'ArrowDown');
    expect(more.getAttribute('aria-expanded')).toBe('true');
    const items = [...group.querySelectorAll('[role=menuitem]')];
    expect(items.map((i) => i.textContent)).toEqual([
      'Styles',
      'Events',
      'Data',
    ]);
    expect(page.document.activeElement).toBe(items[0]);
    press(items[0], 'ArrowDown');
    expect(page.document.activeElement).toBe(items[1]);
    press(items[1], 'End');
    page.document.activeElement.click();
    expect(activeTab(group)).toBe('data');
    expect(page.document.activeElement.dataset.panel).toBe('data');
    expect(group.querySelector('[role=menu]')).toBe(null);
    page.close();
  });

  it('closes the menu with Escape and focuses its button', async () => {
    const page = await mountLayout(TABS);
    const more = page.node('inspector').querySelector('.ui-tab-overflow');
    more.hidden = false;
    more.click();
    const menu = page.document.querySelector('[role=menu]');
    press(page.document.activeElement, 'Escape');
    expect(menu.isConnected).toBe(false);
    expect(page.document.activeElement).toBe(more);
    page.close();
  });
});
