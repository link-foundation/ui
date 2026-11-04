import { describe, it, expect } from 'test-anywhere';
import { createSoundPlayer } from '../src/player.js';
import {
  loadTheme,
  fakeAudio,
  settings,
  gestureTarget,
  seeded,
} from './helpers.js';

function setup({ mode = 'random', enabled = true, reduced = false } = {}) {
  const theme = loadTheme();
  theme.events.click = { mode, voices: ['tick', 'tap', 'chime'], throttle: 0 };
  const target = gestureTarget();
  const config = settings({ 'sound.enabled': enabled });
  const audio = fakeAudio();
  let contexts = 0;
  let time = 0;
  const player = createSoundPlayer({
    theme,
    config,
    random: seeded(),
    now: () => time,
    gestureTarget: target,
    reducedMotion: () => reduced,
    createContext: () => {
      contexts++;
      return audio;
    },
  });
  return {
    player,
    audio,
    config,
    target,
    contexts: () => contexts,
    gesture: (type = 'pointerdown') =>
      target.dispatchEvent(new globalThis.Event(type)),
    advance: (ms) => {
      time += ms;
    },
  };
}

describe('sound player', () => {
  it('never creates audio before a gesture or while disabled by default', async () => {
    const s = setup({ enabled: false });
    s.player.play('click');
    s.gesture();
    s.gesture('keydown');
    expect(s.contexts()).toBe(0);
    s.config.set('sound.enabled', true);
    expect(s.player.play('click')).toEqual([]);
    expect(s.contexts()).toBe(0);
    s.gesture();
    expect(s.contexts()).toBe(1);
    expect(s.player.play('click').length).toBe(1);
    await s.player.dispose();
    const target = gestureTarget();
    let count = 0;
    const player = createSoundPlayer({
      theme: loadTheme(),
      gestureTarget: target,
      createContext: () => {
        count++;
        return fakeAudio();
      },
    });
    target.dispatchEvent(new globalThis.Event('pointerdown'));
    expect(count).toBe(0);
    await player.dispose();
  });
  it('uses seeded random, cycle and layer modes', async () => {
    const runs = [];
    for (let i = 0; i < 2; i++) {
      const s = setup();
      s.gesture();
      runs.push(Array.from({ length: 8 }, () => s.player.play('click')));
      await s.player.dispose();
    }
    expect(runs[0]).toEqual(runs[1]);
    const cycle = setup({ mode: 'cycle' });
    cycle.gesture();
    expect(Array.from({ length: 4 }, () => cycle.player.play('click'))).toEqual(
      [['tick'], ['tap'], ['chime'], ['tick']]
    );
    const layer = setup({ mode: 'layer' });
    layer.gesture();
    expect(layer.player.play('click')).toEqual(['tick', 'tap', 'chime']);
    await cycle.player.dispose();
    await layer.player.dispose();
  });
  it('throttles scan with injected time and gates only motion cues', async () => {
    const s = setup();
    s.gesture();
    expect(s.player.play('scan').length).toBe(1);
    s.advance(119);
    expect(s.player.play('scan')).toEqual([]);
    s.advance(1);
    expect(s.player.play('scan').length).toBe(1);
    const reduced = setup({ reduced: true });
    reduced.gesture();
    expect(reduced.player.play('scan')).toEqual([]);
    expect(reduced.player.cue('intro')).toEqual([]);
    expect(reduced.player.play('click').length).toBe(1);
    await s.player.dispose();
    await reduced.player.dispose();
  });
  it('reports cues while muted, positions stereo and silences the master bus', async () => {
    const s = setup();
    const cues = [];
    const off = s.player.onCue((c) => cues.push(c));
    s.player.cue('click', { x: 0 });
    expect(cues).toEqual([{ event: 'click', pan: -1 }]);
    s.gesture();
    s.player.play('click', { x: 1 });
    expect(s.audio.nodes.find((n) => n.kind === 'panner').pan.value).toBe(1);
    s.player.setVolume(0.23);
    expect(s.config.get('sound.volume')).toBe(0.23);
    s.player.mute();
    expect(s.config.get('sound.enabled')).toBe(false);
    const master = s.audio.nodes.find((n) =>
      n.connections.includes(s.audio.destination)
    );
    expect(master.gain.calls.at(-1)[1]).toBe(0);
    expect(s.player.play('click')).toEqual([]);
    off();
    const length = cues.length;
    s.player.cue('click');
    expect(cues.length).toBe(length);
    await s.player.dispose();
    s.gesture();
    expect(s.contexts()).toBe(1);
    expect(s.audio.state).toBe('closed');
    expect(s.player.play('click')).toEqual([]);
  });
  it('tracks pointer movement without creating audio and resumes a suspended context', async () => {
    const s = setup();
    const move = Object.assign(new globalThis.Event('pointermove'), {
      clientX: 0,
    });
    s.target.dispatchEvent(move);
    expect(s.contexts()).toBe(0);
    s.gesture();
    s.audio.state = 'suspended';
    s.player.play('click');
    expect(s.audio.state).toBe('running');
    expect(s.audio.nodes.find((n) => n.kind === 'panner').pan.value).toBe(-1);
    await s.player.dispose();
  });
  it('reports unavailable audio without breaking interaction', async () => {
    const diagnostics = [];
    const target = gestureTarget();
    const player = createSoundPlayer({
      theme: loadTheme(),
      config: settings({ 'sound.enabled': true }),
      gestureTarget: target,
      createContext: () => {
        throw new Error('unavailable');
      },
      onDiagnostic: (d) => diagnostics.push(d.code),
    });
    target.dispatchEvent(new globalThis.Event('keydown'));
    expect(player.play('click')).toEqual([]);
    expect(diagnostics).toEqual(['audio-unavailable']);
    await player.dispose();
  });
});
