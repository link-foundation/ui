/**
 * bindMachine: a machine service bound to DOM elements without ui-dom.
 */

import { describe, it, expect } from 'test-anywhere';
import { bindMachine } from '@link-foundation/ui-components/a11y';
import {
  DISCLOSURE_MACHINE,
  TOGGLE_MACHINE,
  createManualClock,
  interpret,
} from '@link-foundation/ui-components/behavior';
import { createDom, press } from '../support/dom.js';

describe('bindMachine', () => {
  it('binds the toggle machine to a button', () => {
    const { document } = createDom('<button id="b">Bold</button>');
    const button = document.getElementById('b');
    const service = interpret(TOGGLE_MACHINE);
    const unbind = bindMachine(button, service);
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.dataset.part).toBe('root');
    press(button, 'Enter');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    button.click();
    expect(button.getAttribute('aria-pressed')).toBe('false');
    unbind();
    button.click();
    expect(service.state).toBe('off');
  });

  it('binds the disclosure machine parts and moves focus', () => {
    const { document } = createDom(
      '<button id="t">More</button><div id="c">Details</div>'
    );
    const trigger = document.getElementById('t');
    const content = document.getElementById('c');
    const clock = createManualClock();
    const service = interpret(DISCLOSURE_MACHINE, { clock });
    bindMachine(trigger, service, { trigger, content });
    expect(content.hidden).toBe(true);
    trigger.focus();
    press(trigger, ' ');
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(content.hidden).toBe(false);
    expect(document.activeElement).toBe(content);
    expect(content.getAttribute('tabindex')).toBe('-1');
    press(content, 'Escape');
    expect(document.activeElement).toBe(trigger);
    clock.advance(500);
    expect(content.hidden).toBe(true);
    expect(content.dataset.state).toBe('closed');
  });

  it('reports a part with no element', () => {
    const { document } = createDom('<button id="t">More</button>');
    const diagnostics = [];
    const trigger = document.getElementById('t');
    bindMachine(
      trigger,
      interpret(DISCLOSURE_MACHINE, { clock: createManualClock() }),
      { trigger, content: null },
      { onDiagnostic: (d) => diagnostics.push(d) }
    );
    expect(diagnostics.map((d) => [d.code, d.at.part])).toEqual([
      ['unknown-part', 'content'],
    ]);
  });

  it('never writes on* attributes', () => {
    const { document } = createDom('<button id="b">B</button>');
    const service = interpret(`(m: machine
  (initial a)
  (state a)
  (part root (attr onclick 'alert(1)') (attr title ok)))`);
    bindMachine(document.getElementById('b'), service);
    const button = document.getElementById('b');
    expect(button.hasAttribute('onclick')).toBe(false);
    expect(button.getAttribute('title')).toBe('ok');
  });
});
