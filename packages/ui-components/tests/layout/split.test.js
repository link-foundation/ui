/**
 * split kind: a WAI-ARIA window splitter. The arrow keys move a divider by
 * 1%, Home collapses (or shrinks) the pane, End grows it, Enter toggles it;
 * the sizes respect min and max and are remembered in the storage.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  sizesFromLino,
  sizesToLino,
  splitSizes,
} from '@link-foundation/ui-components';
import { memoryStorage, mountLayout, press } from './helpers.js';

// One sublink per line: two links on one indented line form a group.
const CHAT = `(chat: split (label Chat) (sizes 30 70) (min 20) (max 60 90)
  (collapsible true false)
  (remember-size gallery.chat)
  (chat-list: panel (title Conversations) (a: text 'List'))
  (chat-view: panel (title Thread) (b: text 'Thread')))`;

const dividerOf = (node) => node.querySelector('[role=separator]');

describe('split kind', () => {
  it('renders a focusable separator with the aria values of its pane', async () => {
    const page = await mountLayout(CHAT);
    const split = page.node('chat');
    const divider = dividerOf(split);
    expect(splitSizes(split)).toEqual([30, 70]);
    expect(divider.tabIndex).toBe(0);
    expect(divider.getAttribute('aria-valuenow')).toBe('30');
    // The divider can go down to the min (20); Home collapses the pane.
    expect(divider.getAttribute('aria-valuemin')).toBe('20');
    expect(divider.getAttribute('aria-valuemax')).toBe('60');
    expect(divider.getAttribute('aria-orientation')).toBe('vertical');
    const pane = page.node('chat-list');
    expect(divider.getAttribute('aria-controls')).toBe(pane.id);
    expect(divider.getAttribute('aria-label')).toBe('Resize Conversations');
    expect(page.diagnostics).toEqual([]);
    page.close();
  });

  it('moves the divider by 1% with the arrows and 10% with Shift', async () => {
    const page = await mountLayout(CHAT);
    const split = page.node('chat');
    const divider = dividerOf(split);
    const sizes = [];
    split.addEventListener('split-resize', (e) => sizes.push(e.detail.sizes));
    expect(press(divider, 'ArrowRight').defaultPrevented).toBe(true);
    expect(splitSizes(split)).toEqual([31, 69]);
    press(divider, 'ArrowLeft');
    press(divider, 'ArrowLeft');
    expect(splitSizes(split)).toEqual([29, 71]);
    press(divider, 'ArrowRight', { shiftKey: true });
    expect(splitSizes(split)).toEqual([39, 61]);
    expect(divider.getAttribute('aria-valuenow')).toBe('39');
    expect(sizes.at(-1)).toEqual([39, 61]);
    page.close();
  });

  it('leaves the arrows with Ctrl, Alt or Meta to the browser', async () => {
    const page = await mountLayout(CHAT);
    const split = page.node('chat');
    const divider = dividerOf(split);
    for (const modifier of ['ctrlKey', 'altKey', 'metaKey']) {
      const event = press(divider, 'ArrowRight', { [modifier]: true });
      expect(event.defaultPrevented).toBe(false);
    }
    expect(splitSizes(split)).toEqual([30, 70]);
    page.close();
  });

  it('keeps every pane within min and max, with a constant total', async () => {
    const page = await mountLayout(CHAT);
    const split = page.node('chat');
    const divider = dividerOf(split);
    press(divider, 'End');
    expect(splitSizes(split)).toEqual([60, 40]);
    for (let i = 0; i < 10; i++) {
      press(divider, 'ArrowRight', { shiftKey: true });
    }
    expect(splitSizes(split)).toEqual([60, 40]);
    for (let i = 0; i < 10; i++) {
      press(divider, 'ArrowLeft', { shiftKey: true });
    }
    // The second pane may not exceed 90 of 100: the first keeps 20 (min).
    expect(splitSizes(split)).toEqual([20, 80]);
    page.close();
  });

  it('collapses a collapsible pane with Home and restores it with Enter', async () => {
    // Without a max on the second pane, which takes the whole width then.
    const page = await mountLayout(CHAT.replace('(max 60 90)', '(max 60 100)'));
    const split = page.node('chat');
    const divider = dividerOf(split);
    press(divider, 'Home');
    expect(splitSizes(split)).toEqual([0, 100]);
    expect(page.node('chat-list').hidden).toBe(true);
    press(divider, 'Enter');
    expect(splitSizes(split)).toEqual([30, 70]);
    expect(page.node('chat-list').hidden).toBe(false);
    press(divider, 'Enter');
    expect(splitSizes(split)).toEqual([0, 100]);
    page.close();
  });

  it('remembers its sizes in the storage and reads them back', async () => {
    const storage = memoryStorage();
    const first = await mountLayout(CHAT, { storage });
    press(dividerOf(first.node('chat')), 'ArrowRight', { shiftKey: true });
    first.close();
    expect(storage.map.get('gallery.chat')).toBe('sizes 40 60');
    const second = await mountLayout(CHAT, { storage });
    expect(splitSizes(second.node('chat'))).toEqual([40, 60]);
    second.close();
  });

  it('reads the sizes stored in parentheses before #133', () => {
    expect(sizesFromLino('(sizes 40 60)')).toEqual([40, 60]);
    expect(sizesFromLino(sizesToLino([40, 60]))).toEqual([40, 60]);
  });

  it('does not collapse a pane when the other would pass its max', async () => {
    const page = await mountLayout(CHAT);
    press(dividerOf(page.node('chat')), 'Home');
    expect(splitSizes(page.node('chat'))).toEqual([30, 70]);
    page.close();
  });

  it('ignores a remembered value that is not sizes', async () => {
    const storage = memoryStorage({ 'gallery.chat': 'not sizes' });
    const page = await mountLayout(CHAT, { storage });
    expect(splitSizes(page.node('chat'))).toEqual([30, 70]);
    page.close();
  });

  it('lays out a column split with horizontal separators', async () => {
    const page =
      await mountLayout(`(s: split (direction column) (sizes 50 25 25)
      (a: text 'A')
      (b: text 'B')
      (c: text 'C'))`);
    const split = page.node('s');
    const dividers = split.querySelectorAll('[role=separator]');
    expect(dividers.length).toBe(2);
    expect(dividers[1].getAttribute('aria-orientation')).toBe('horizontal');
    press(dividers[1], 'ArrowDown');
    expect(splitSizes(split)).toEqual([50, 26, 24]);
    page.close();
  });
});
