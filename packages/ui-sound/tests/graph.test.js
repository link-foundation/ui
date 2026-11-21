import { describe, it, expect } from 'test-anywhere';
import { createSoundBus, playVoice } from '../src/graph.js';
import { loadTheme, fakeAudio, seeded } from './helpers.js';

describe('Web Audio graph', () => {
  it('schedules tick to true silence and disconnects every transient node', () => {
    const audio = fakeAudio();
    const voice = loadTheme().voices.tick;
    const end = playVoice(audio, voice, audio.destination, {
      at: 1,
      pan: -0.5,
    });
    const amp = audio.nodes.find((n) => n.kind === 'gain');
    const osc = audio.nodes.find((n) => n.kind === 'oscillator');
    expect(osc.type).toBe('triangle');
    expect(osc.frequency.calls[0]).toEqual(['set', 880, 1]);
    expect(Math.abs(end - 1.062) < 1e-10).toBe(true);
    expect(amp.gain.calls.at(-1)).toEqual(['linear', 0, end]);
    expect(osc.stopped).toBe(end);
    expect(audio.nodes.find((n) => n.kind === 'panner').pan.value).toBe(-0.5);
    osc.onended();
    expect(audio.nodes.every((n) => n.disconnected)).toBe(true);
  });
  it('builds the shelf, limiter, reverb and final volume bus', () => {
    const audio = fakeAudio();
    const bus = createSoundBus(audio, loadTheme().bus, seeded());
    expect(audio.nodes.find((n) => n.kind === 'filter').type).toBe('highshelf');
    expect(audio.nodes.find((n) => n.kind === 'compressor').ratio.value).toBe(
      4
    );
    expect(audio.nodes.some((n) => n.kind === 'convolver')).toBe(true);
    expect(bus.master.connections).toEqual([audio.destination]);
    bus.disconnect();
    expect(audio.nodes.every((n) => n.disconnected)).toBe(true);
  });
  it('renders all 26 ported patches including noise, FM, repeats and filters', () => {
    const theme = loadTheme('immortality');
    const audio = fakeAudio();
    for (const voice of Object.values(theme.voices)) {
      expect(
        playVoice(audio, voice, audio.destination, { random: seeded() }) > 0
      ).toBe(true);
    }
    expect(audio.nodes.some((n) => n.kind === 'noise')).toBe(true);
    expect(audio.nodes.filter((n) => n.kind === 'oscillator').length > 26).toBe(
      true
    );
    expect(audio.nodes.some((n) => n.kind === 'filter')).toBe(true);
    expect(
      audio.nodes
        .filter((n) => n.kind === 'oscillator' || n.kind === 'noise')
        .every((n) => n.stopped > n.started)
    ).toBe(true);
  });
});

describe('Host audio routing', () => {
  it('plays quiet and stacked instances of the same patch through either volume placement', () => {
    const theme = loadTheme();
    for (const gainPlacement of ['input', 'output']) {
      const audio = fakeAudio();
      const destination = audio.createGain();
      const bus = createSoundBus(audio, theme.bus, seeded(), {
        gainPlacement,
        destination: () => destination,
      });
      const compressor = audio.nodes.find((node) => node.kind === 'compressor');
      expect(bus.input.connections).toEqual([bus.shelf]);
      expect(bus.shelf.connections).toEqual([compressor, bus.convolver]);
      expect(bus.wet.connections).toEqual([compressor]);
      expect(compressor.connections).toEqual([
        gainPlacement === 'input' ? destination : bus.master,
      ]);
      const volume = gainPlacement === 'input' ? bus.input : bus.master;
      expect(bus.master).toBe(volume);
      bus.configure({ volume: 0.6, room: 0.5 });
      expect(volume.gain.calls).toEqual([['target', 0.6, 0, 0.02]]);
      for (const voices of [1, 3]) {
        const start = audio.nodes.length;
        for (let voice = 0; voice < voices; voice++) {
          playVoice(audio, theme.voices.tick, bus.input, { gain: 0.1 });
        }
        const peaks = audio.nodes
          .slice(start)
          .filter((node) => node.kind === 'gain');
        expect(peaks.map((node) => node.gain.calls[2][1])).toEqual(
          Array(voices).fill(theme.voices.tick.parts[0].gain * 0.1)
        );
      }
      bus.disconnect();
      expect(destination.disconnected).toBe(undefined);
    }
  });
});
