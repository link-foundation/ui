import { describe, it, expect } from 'test-anywhere';
import { createSoundBus, playVoice, createSoundPlayer } from '../src/index.js';
import { fakeAudio, loadTheme, seeded, settings } from './helpers.js';
import { JSDOM } from 'jsdom';

function setup(options = {}) {
  const { window } = new JSDOM('', { pretendToBeVisual: true });
  const audio = fakeAudio();
  const theme = loadTheme();
  theme.events.click = { voices: ['tick', 'tap'], mode: 'random', throttle: 0 };
  let contexts = 0;
  const player = createSoundPlayer({
    theme,
    config: settings({ 'sound.enabled': true }),
    gestureTarget: window,
    document: window.document,
    hasBeenActive: () => true,
    random: seeded(),
    createContext: () => {
      contexts++;
      return audio;
    },
    ...options,
  });
  return {
    player,
    audio,
    theme,
    window,
    contexts: () => contexts,
    async dispose() {
      await player.dispose();
      window.close();
    },
  };
}

describe('live sound contracts', () => {
  it('changes existing bus nodes smoothly, including an initially dry send', () => {
    const audio = fakeAudio();
    const bus = createSoundBus(
      audio,
      { ...loadTheme().bus, reverb: 0 },
      seeded()
    );
    const count = audio.nodes.length;
    const impulse = bus.convolver.buffer;
    bus.configure({
      volume: 0.7,
      tone: 5,
      frequency: 3200,
      reverb: 0.5,
      room: 3,
    });
    expect(audio.nodes.length).toBe(count);
    for (const [param, value] of [
      [bus.master.gain, 0.7],
      [bus.shelf.gain, 5],
      [bus.shelf.frequency, 3200],
      [bus.wet.gain, 0.5],
    ]) {
      expect(param.calls.at(-1)).toEqual(['target', value, 0, 0.02]);
    }
    expect(bus.convolver.buffer === impulse).toBe(false);
    expect(bus.convolver.buffer.getChannelData(0).length).toBe(24000);
    bus.disconnect();
  });
  it('keeps all delayed and repeated envelopes silent from context time zero', () => {
    const audio = fakeAudio();
    const voice = loadTheme().voices.tick;
    playVoice(audio, { ...voice, repeat: 3, gap: 0.01001 }, audio.destination, {
      at: 0.00001,
    });
    for (const amp of audio.nodes.filter((n) => n.kind === 'gain')) {
      expect(amp.gain.value).toBe(0);
      expect(amp.gain.calls[0]).toEqual(['set', 0, 0]);
      expect(amp.gain.calls[1][1]).toBe(0);
    }
  });
  it('reuses a noise buffer across plays with independent random offsets', () => {
    const audio = fakeAudio();
    const voice = loadTheme('immortality').voices;
    const noise = Object.values(voice).find((v) =>
      v.parts.some((p) => p.kind === 'noise')
    );
    const random = seeded();
    for (let i = 0; i < 20; i++) {
      playVoice(audio, noise, audio.destination, { random });
    }
    const sources = audio.nodes.filter((n) => n.kind === 'noise');
    expect(new Set(sources.map((n) => n.buffer)).size).toBe(1);
    expect(audio.buffers.length).toBe(1);
    expect(new Set(sources.map((n) => n.offset)).size > 1).toBe(true);
    expect(sources.every((n) => n.loop)).toBe(true);
  });
  it('unlocks on sticky activation, updates the live bus, and suspends hidden pages', async () => {
    const s = setup();
    expect(s.player.play('click').length).toBe(1);
    const convolver = s.audio.nodes.find((n) => n.kind === 'convolver');
    const old = convolver.buffer;
    s.player.configure({ tone: -7, reverb: 0.5, room: 2, volume: 0.8 });
    expect(s.contexts()).toBe(1);
    expect(convolver.buffer === old).toBe(false);
    Object.defineProperty(s.window.document, 'hidden', {
      value: true,
      configurable: true,
    });
    s.window.document.dispatchEvent(new s.window.Event('visibilitychange'));
    expect(s.audio.state).toBe('suspended');
    Object.defineProperty(s.window.document, 'hidden', { value: false });
    s.player.play('click');
    expect(s.audio.state).toBe('running');
    await s.dispose();
    const locked = setup({ hasBeenActive: () => false });
    expect(locked.player.play('click')).toEqual([]);
    expect(locked.contexts()).toBe(0);
    await locked.dispose();
  });
});

describe('playback contracts', () => {
  it('enables and plays in the same first click after capture observed activation', async () => {
    const s = setup({ config: settings(), hasBeenActive: () => false });
    s.window.dispatchEvent(new s.window.Event('pointerdown'));
    s.player.mute(false);
    expect(s.player.play('click').length).toBe(1);
    expect(s.contexts()).toBe(1);
    await s.dispose();
  });
  it('never repeats either of two random voices over 1000 plays; one voice is stable', async () => {
    const s = setup();
    let previous;
    for (let i = 0; i < 1000; i++) {
      const [name] = s.player.play('click');
      expect(name !== previous).toBe(true);
      previous = name;
    }
    s.player.configure({ events: { click: { voices: ['tick'] } } });
    expect(s.player.play('click')).toEqual(['tick']);
    expect(s.player.play('click')).toEqual(['tick']);
    s.player.configure({ events: { click: { voices: [] } } });
    expect(s.player.play('click')).toEqual([]);
    await s.dispose();
  });
  it('applies exact deterministic gain, level, mode, stereo width and part pan', async () => {
    const s = setup();
    s.theme.voices.tick.parts[0].pan = 0.2;
    s.player.configure({
      pitchSpread: 0,
      stereo: false,
      events: { click: { voices: ['tick'], level: 2 } },
    });
    s.player.play('click', { x: 1 });
    expect(s.audio.nodes.find((n) => n.kind === 'panner').pan.value).toBe(0.2);
    expect(
      s.audio.nodes.find((n) => n.kind === 'oscillator').detune.value
    ).toBe(0);
    expect(
      s.audio.nodes
        .filter((n) => n.kind === 'gain')
        .at(-1)
        .gain.calls.find((c) => c[0] === 'linear')[1]
    ).toBe(s.theme.voices.tick.parts[0].gain * 2);
    s.player.configure({ stereo: true, width: 0.5 });
    s.player.preview('tap', { x: 1 });
    expect(
      s.audio.nodes.filter((n) => n.kind === 'panner').at(-1).pan.value
    ).toBe(0.5);
    s.player.configure({
      mode: 'layer',
      events: { click: { voices: ['tick', 'tap'], level: 1 } },
    });
    expect(s.player.play('click')).toEqual(['tick', 'tap']);
    const amps = s.audio.nodes.filter((n) => n.kind === 'gain').slice(-2);
    expect(amps[0].gain.calls.find((c) => c[0] === 'linear')[1]).toBe(
      s.theme.voices.tick.parts[0].gain / Math.sqrt(2)
    );
    s.player.mute();
    expect(s.player.preview('tap')).toEqual([]);
    await s.dispose();
  });
  it('replaces runtime modes and throttles and scales humanization below 15 cents', async () => {
    let time = 0;
    const s = setup({ now: () => time, random: () => 1 });
    s.player.configure({
      mode: 'cycle',
      pitchSpread: 7.5,
      events: { click: { voices: ['tap', 'tick'], throttle: 100 } },
    });
    expect(s.player.play('click')).toEqual(['tap']);
    expect(s.player.play('click')).toEqual([]);
    time = 100;
    expect(s.player.play('click')).toEqual(['tick']);
    const oscillator = s.audio.nodes
      .filter((n) => n.kind === 'oscillator')
      .at(-1);
    expect(oscillator.detune.value).toBe(7.5);
    const peak = s.audio.nodes
      .filter((n) => n.kind === 'gain')
      .at(-1)
      .gain.calls.find((c) => c[0] === 'linear')[1];
    expect(peak).toBe(s.theme.voices.tick.parts[0].gain * 1.05);
    s.player.configure({
      mode: null,
      events: { click: { mode: 'layer', throttle: 0 } },
    });
    expect(s.player.play('click')).toEqual(['tap', 'tick']);
    s.player.setVolume(0);
    expect(s.player.preview('tick')).toEqual([]);
    await s.dispose();
  });
  it('bounds spread 15 detune and level, and respects configurable motion suppression', async () => {
    const s = setup({
      reducedMotion: () => true,
      reducedMotionEvents: ['click'],
    });
    expect(s.player.play('click')).toEqual([]);
    for (let i = 0; i < 100; i++) {
      s.player.preview('tick');
    }
    for (const osc of s.audio.nodes.filter((n) => n.kind === 'oscillator')) {
      expect(Math.abs(osc.detune.value) <= 15).toBe(true);
    }
    const peak = s.theme.voices.tick.parts[0].gain;
    for (const amp of s.audio.nodes.filter(
      (n) => n.kind === 'gain' && n.gain.calls.some((c) => c[0] === 'linear')
    )) {
      const value = amp.gain.calls.find((c) => c[0] === 'linear')[1];
      expect(value >= peak * 0.9 && value <= peak * 1.1).toBe(true);
    }
    await s.dispose();
  });
});

it('preserves event throttling for muted visual cues without queuing audio', async () => {
  let time = 0;
  const s = setup({ config: settings(), now: () => time });
  s.player.configure({ events: { click: { throttle: 100 } } });
  const cues = [];
  s.player.onCue((cue) => cues.push(cue.event));
  expect(s.player.play('click')).toEqual([]);
  expect(s.player.play('click')).toEqual([]);
  expect(cues).toEqual(['click']);
  expect(s.contexts()).toBe(0);
  time = 100;
  s.player.play('click');
  expect(cues).toEqual(['click', 'click']);
  expect(s.contexts()).toBe(0);
  await s.dispose();
});
