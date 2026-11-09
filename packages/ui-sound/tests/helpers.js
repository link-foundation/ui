import { URL } from 'node:url';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { readSoundTheme } from '../src/theme.js';

export const loadTheme = (name = 'quiet') =>
  readSoundTheme(
    readFileSync(new URL(`../themes/${name}.lino`, import.meta.url), 'utf8')
  ).theme;
export function seeded(seed = 42) {
  let n = seed;
  return () => (n = (Math.imul(n, 1664525) + 1013904223) >>> 0) / 4294967296;
}
export function fakeAudio() {
  const nodes = [];
  const buffers = [];
  const param = () => ({
    value: 0,
    calls: [],
    setValueAtTime(v, t) {
      this.calls.push(['set', v, t]);
    },
    setTargetAtTime(v, t, constant) {
      this.calls.push(['target', v, t, constant]);
    },
    linearRampToValueAtTime(v, t) {
      this.calls.push(['linear', v, t]);
    },
    exponentialRampToValueAtTime(v, t) {
      this.calls.push(['exponential', v, t]);
    },
  });
  const node = (kind) => {
    const n = {
      kind,
      connections: [],
      gain: param(),
      frequency: param(),
      detune: param(),
      pan: param(),
      Q: param(),
      threshold: param(),
      ratio: param(),
      knee: param(),
      attack: param(),
      release: param(),
      connect(target) {
        this.connections.push(target);
        return target;
      },
      disconnect() {
        this.disconnected = true;
      },
      start(t, offset) {
        this.started = t;
        this.offset = offset;
      },
      stop(t) {
        this.stopped = t;
      },
    };
    nodes.push(n);
    return n;
  };
  return {
    nodes,
    buffers,
    currentTime: 0,
    sampleRate: 8000,
    state: 'running',
    destination: {},
    createGain: () => node('gain'),
    createOscillator: () => node('oscillator'),
    createBiquadFilter: () => node('filter'),
    createDynamicsCompressor: () => node('compressor'),
    createConvolver: () => node('convolver'),
    createStereoPanner: () => node('panner'),
    createBufferSource: () => node('noise'),
    createBuffer: (channels, length) => {
      const data = Array.from(
        { length: channels },
        () => new Float32Array(length)
      );
      const buffer = { getChannelData: (i) => data[i] };
      buffers.push(buffer);
      return buffer;
    },
    suspend() {
      this.state = 'suspended';
      return Promise.resolve();
    },
    resume() {
      this.state = 'running';
      return Promise.resolve();
    },
    close() {
      this.state = 'closed';
      return Promise.resolve();
    },
  };
}
export function settings(initial = {}) {
  const values = { 'sound.enabled': false, 'sound.volume': 0.5, ...initial };
  const listeners = new Set();
  return {
    get: (key) => values[key],
    set(key, value) {
      values[key] = value;
      listeners.forEach((fn) => fn(values));
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
  };
}
export function gestureTarget() {
  // Keep Event and EventTarget in one DOM realm across Node, Bun and Deno.
  const { window } = new JSDOM();
  const target = new window.EventTarget();
  target.Event = window.Event;
  window.close();
  target.innerWidth = 100;
  return target;
}
