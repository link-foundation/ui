import { describe, it, expect } from 'test-anywhere';
import { JSDOM } from 'jsdom';
import { bindSoundToDocument } from '../src/index.js';

function setup() {
  const dom = new JSDOM(`<!doctype html><body>
    <button id="button"><span id="child">Go</span></button><a id="link" href="#">Link</a>
    <input id="checkbox" type="checkbox"><button id="pressed" aria-pressed="false">Toggle</button>
    <input id="radio" type="radio"><div id="tab" role="tab" tabindex="0">Tab</div>
    <div id="role-radio" role="radio" tabindex="0">Radio</div>
    <div data-sound="notify" id="override"><button id="inside">Override</button></div>
    <button id="disabled" disabled>Disabled</button><div aria-disabled="true"><button id="aria-disabled">Disabled parent</button></div>
    <fieldset disabled><button id="fieldset-disabled">Disabled fieldset</button></fieldset>
    <details id="details"><summary id="summary">Details</summary></details>
    <input id="range" type="range"><input id="text"><textarea id="textarea"></textarea>
    <select id="select"><option>A</option></select><input id="color" type="color">
    <div id="scan" data-sound-scan><span id="scan-child">Scan</span></div>
  </body>`);
  const calls = [];
  let time = 0;
  const player = { hoverGap: 80, play: (name) => calls.push(name) };
  const binding = bindSoundToDocument(player, {
    root: dom.window.document,
    now: () => time,
    cueEvent: 'test-cue',
  });
  const fire = (id, type, props = {}) => {
    const target = dom.window.document.getElementById(id);
    const event = new dom.window.Event(type, { bubbles: true });
    Object.assign(event, props);
    target.dispatchEvent(event);
  };
  return {
    ...dom,
    window: dom.window,
    calls,
    fire,
    player,
    binding,
    advance(ms) {
      time += ms;
    },
    close() {
      binding.dispose();
      dom.window.close();
    },
  };
}

describe('document sound binding', () => {
  it('classifies native/ARIA controls, nested targets and ancestor overrides', () => {
    const s = setup();
    for (const [id, expected] of [
      ['child', 'activate'],
      ['link', 'activate'],
      ['checkbox', 'toggle'],
      ['pressed', 'toggle'],
      ['radio', 'select'],
      ['tab', 'select'],
      ['role-radio', 'select'],
      ['inside', 'notify'],
    ]) {
      s.fire(id, 'click');
      expect(s.calls.at(-1)).toBe(expected);
    }
    const count = s.calls.length;
    for (const id of [
      'disabled',
      'aria-disabled',
      'fieldset-disabled',
      'summary',
    ]) {
      s.fire(id, 'click');
    }
    expect(s.calls.length).toBe(count);
    const details = s.window.document.getElementById('details');
    details.open = true;
    s.fire('details', 'toggle');
    details.open = false;
    s.fire('details', 'toggle');
    expect(s.calls.slice(-2)).toEqual(['open', 'close']);
    details.dataset.sound = 'notify';
    const toggles = s.calls.length;
    s.fire('summary', 'click');
    expect(s.calls.length).toBe(toggles);
    s.fire('details', 'toggle');
    expect(s.calls.slice(toggles)).toEqual(['notify']);
    s.close();
  });
  it('hovers once per entered control, throttles and excludes touch and pen', () => {
    const s = setup();
    s.fire('button', 'pointerover', {
      pointerType: 'mouse',
      relatedTarget: null,
    });
    s.advance(100);
    s.fire('child', 'pointerover', {
      pointerType: 'mouse',
      relatedTarget: s.window.document.getElementById('button'),
    });
    s.fire('link', 'pointerover', { pointerType: 'touch' });
    s.fire('link', 'pointerover', { pointerType: 'pen' });
    expect(s.calls).toEqual(['hover']);
    s.fire('link', 'pointerover', { pointerType: 'mouse' });
    s.fire('button', 'pointerover', { pointerType: 'mouse' });
    expect(s.calls).toEqual(['hover', 'hover']);
    s.advance(80);
    s.fire('button', 'pointerover', { pointerType: 'mouse' });
    expect(s.calls).toEqual(['hover', 'hover', 'hover']);
    s.close();
  });
  it('maps input/change/scan with independent finite throttles', () => {
    const s = setup();
    s.fire('range', 'input');
    s.fire('range', 'input');
    s.advance(70);
    s.fire('range', 'input');
    s.fire('text', 'input');
    s.fire('textarea', 'input');
    s.advance(30);
    s.fire('textarea', 'input');
    s.fire('select', 'change');
    s.fire('color', 'change');
    s.fire('scan-child', 'pointermove', { pointerType: 'mouse' });
    s.fire('scan-child', 'pointermove', { pointerType: 'mouse' });
    s.advance(90);
    s.fire('scan-child', 'pointermove', { pointerType: 'mouse' });
    expect(s.calls).toEqual([
      'select',
      'select',
      'type',
      'type',
      'select',
      'select',
      'scan',
      'scan',
    ]);
    s.close();
  });
  it('supports the window cue channel, scoped roots, runtime gap and disposal', () => {
    const s = setup();
    s.window.dispatchEvent(
      new s.window.CustomEvent('test-cue', { detail: { event: 'intro' } })
    );
    s.window.dispatchEvent(
      new s.window.CustomEvent('test-cue', { detail: 'notify' })
    );
    s.window.dispatchEvent(
      new s.window.CustomEvent('test-cue', { detail: {} })
    );
    expect(s.calls).toEqual(['intro', 'notify']);
    s.binding.dispose();
    s.fire('button', 'click');
    s.window.dispatchEvent(
      new s.window.CustomEvent('test-cue', { detail: 'notify' })
    );
    expect(s.calls).toEqual(['intro', 'notify']);
    const scoped = bindSoundToDocument(s.player, {
      root: s.window.document.getElementById('override'),
    });
    s.fire('button', 'click');
    s.fire('inside', 'click');
    expect(s.calls.at(-1)).toBe('notify');
    expect(s.calls.length).toBe(3);
    scoped.dispose();
    s.close();
  });
});
