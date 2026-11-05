/**
 * accordion: the disclosure machine over a heading, a native button and a
 * labelled region, with the APG keys and focus of an accordion.
 */

import { describe, it, expect } from 'test-anywhere';
import { parse } from '@link-foundation/ui-core';
import { renderToHTML } from '@link-foundation/ui-dom';
import {
  controlsVocabulary,
  registerControls,
} from '../../src/controls/index.js';
import { press } from '../support/dom.js';
import { attrs, microtasks, mountDoc } from '../support/controls.js';

registerControls();

const GROUP = `  (faq: stack
    (a: accordion Shipping (x: text 'Two days.'))
    (b: accordion Returns (disabled true) (y: text 'Free.'))
    (c: accordion Warranty (z: button Claim)))`;

describe('accordion', () => {
  it('wires the heading, the button and the region to each other', () => {
    const t = mountDoc(`  (a: accordion Shipping (x: text 'Two days.'))`);
    expect(t.codes()).toEqual([]);
    const trigger = t.part('a', 'trigger');
    const content = t.part('a', 'content');
    expect(attrs(t.part('a', 'heading'), ['role', 'aria-level'])).toEqual({
      role: 'heading',
      'aria-level': '3',
    });
    expect(trigger.localName).toBe('button');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(trigger.getAttribute('aria-controls')).toBe(content.id);
    expect(content.getAttribute('role')).toBe('region');
    expect(content.getAttribute('aria-labelledby')).toBe(trigger.id);
    expect(content.hidden).toBe(true);
    expect(content.textContent).toContain('Two days.');
    expect(t.part('a', 'indicator').getAttribute('aria-hidden')).toBe('true');
  });

  it('takes its heading level, within 1 to 6', () => {
    const t = mountDoc(`  (a: accordion A (heading-level 2))
  (b: accordion B (heading-level 9))`);
    expect(t.part('a', 'heading').getAttribute('aria-level')).toBe('2');
    expect(t.part('b', 'heading').getAttribute('aria-level')).toBe('6');
  });

  it('warns about a missing label', () => {
    expect(mountDoc(`  (a: accordion)`).codes()).toEqual([
      'missing-label@a:label',
    ]);
  });

  it('toggles on a click and commits open to the store', () => {
    const t = mountDoc(`  (a: accordion Shipping)`);
    const trigger = t.part('a', 'trigger');
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(t.part('a', 'content').hidden).toBe(false);
    expect(t.prop('a', 'open')).toEqual(['true']);
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(t.part('a', 'content').getAttribute('data-state')).toBe('closing');
    expect(t.changes.map((change) => change.value)).toEqual([true, false]);
  });

  for (const key of ['Enter', ' ']) {
    it(`toggles on the key "${key}" and leaves focus on the header`, () => {
      const t = mountDoc(`  (a: accordion Shipping (b: button Go))`);
      const trigger = t.part('a', 'trigger');
      trigger.focus();
      press(trigger, key);
      expect(trigger.getAttribute('aria-expanded')).toBe('true');
      expect(t.document.activeElement).toBe(trigger);
    });
  }

  it('animates a change but not the state it mounted in', () => {
    const t = mountDoc(`  (a: accordion Returns (open true))`);
    const content = t.part('a', 'content');
    expect(content.getAttribute('data-state')).toBe('open');
    expect(content.hasAttribute('data-animated')).toBe(false);
    t.part('a', 'trigger').click();
    expect(content.hasAttribute('data-animated')).toBe(true);
  });

  it('closes on Escape from the section and returns focus', () => {
    const t = mountDoc(`  (a: accordion Shipping (open true) (b: button Go))`);
    const trigger = t.part('a', 'trigger');
    const inner = t.part('b', 'root');
    inner.focus();
    press(inner, 'Escape');
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(t.document.activeElement).toBe(trigger);
  });

  it('moves between its sibling headers, skipping disabled ones', () => {
    const t = mountDoc(GROUP);
    const a = t.part('a', 'trigger');
    const c = t.part('c', 'trigger');
    a.focus();
    press(a, 'ArrowDown');
    expect(t.document.activeElement).toBe(c);
    press(c, 'ArrowDown');
    expect(t.document.activeElement).toBe(a);
    press(a, 'ArrowUp');
    expect(t.document.activeElement).toBe(c);
    press(c, 'Home');
    expect(t.document.activeElement).toBe(a);
    press(a, 'End');
    expect(t.document.activeElement).toBe(c);
  });

  it('leaves the arrow keys of the section alone', () => {
    const t = mountDoc(GROUP);
    const inner = t.part('z', 'root');
    t.part('c', 'trigger').click();
    inner.focus();
    press(inner, 'ArrowDown');
    expect(t.document.activeElement).toBe(inner);
  });

  it('cannot be toggled by the user while disabled', () => {
    const t = mountDoc(`  (a: accordion Shipping (disabled true))`);
    const trigger = t.part('a', 'trigger');
    expect(trigger.disabled).toBe(true);
    press(trigger, 'Enter');
    trigger.click();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(t.changes).toEqual([]);
  });

  it('follows the open property, even disabled, without committing', async () => {
    const t = mountDoc(`  (a: accordion Shipping (open true) (disabled true))`);
    expect(t.part('a', 'trigger').getAttribute('aria-expanded')).toBe('true');
    expect(t.part('a', 'content').hidden).toBe(false);
    t.mounted.store.setProp('a', 'open', ['false']);
    await microtasks();
    expect(t.part('a', 'trigger').getAttribute('aria-expanded')).toBe('false');
    expect(t.changes).toEqual([]);
  });

  it('settles closed after the closing delay', async () => {
    const t = mountDoc(`  (a: accordion Shipping (open true))`);
    t.part('a', 'trigger').click();
    await new Promise((resolve) => setTimeout(resolve, 540));
    expect(t.part('a', 'content').hidden).toBe(true);
    expect(t.changes.length).toBe(1);
  });

  it('renders to static HTML, open or closed', () => {
    const diagnostics = [];
    const html = renderToHTML(
      parse(
        `(a: accordion One (open true) (x: text Body))
(b: accordion Two)
(c: chip Ada (removable true))
(d: chip Bob (removed true))`,
        { vocabulary: controlsVocabulary() }
      ),
      { onDiagnostic: (d) => diagnostics.push(d.code) }
    );
    expect(diagnostics).toEqual([]);
    expect(html).toContain('<ui-accordion data-link-id="a"');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('Body');
    expect(html).toContain('aria-label="Remove Ada"');
    expect(html).toMatch(/<ui-chip data-link-id="d"[^>]* hidden=""/u);
  });
});
