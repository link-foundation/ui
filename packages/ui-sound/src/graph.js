/** Build bounded Web Audio graphs. Context, time and randomness are injectable. */
const bound = (n, min, max) => Math.max(min, Math.min(max, n));
const noiseBuffers = new WeakMap();

function cachedNoise(audio, random) {
  let entry = noiseBuffers.get(audio);
  if (!entry || entry.sampleRate !== audio.sampleRate) {
    entry = {
      sampleRate: audio.sampleRate,
      buffer: noiseBuffer(audio, 2, 1, random),
    };
    noiseBuffers.set(audio, entry);
  }
  return entry.buffer;
}

const clamp = (n) => Math.max(-1, Math.min(1, n));

function noiseBuffer(audio, seconds, channels, random, decay = false) {
  const length = Math.ceil(audio.sampleRate * seconds);
  const buffer = audio.createBuffer(channels, length, audio.sampleRate);
  for (let channel = 0; channel < channels; channel++) {
    const data = buffer.getChannelData(channel);
    let last = 0;
    for (let i = 0; i < length; i++) {
      const n = random() * 2 - 1;
      last = decay ? last * 0.55 + n * 0.45 : n;
      data[i] = last * (decay ? (1 - i / length) ** 3.2 : 1);
    }
  }
  return buffer;
}

/** Shelf → dry/reverb → compressor → master volume (including wet tails). */
export function createSoundBus(audio, settings, random = Math.random) {
  const input = audio.createGain();
  const shelf = audio.createBiquadFilter();
  shelf.type = 'highshelf';
  shelf.frequency.value = settings.shelf[0];
  shelf.gain.value = settings.shelf[1];
  const compressor = audio.createDynamicsCompressor();
  compressor.threshold.value = settings.compressor[0];
  compressor.ratio.value = settings.compressor[1];
  compressor.knee.value = 12;
  compressor.attack.value = 0.003;
  compressor.release.value = 0.15;
  const master = audio.createGain();
  const nodes = [input, shelf, compressor, master];
  input
    .connect(shelf)
    .connect(compressor)
    .connect(master)
    .connect(audio.destination);
  const convolver = audio.createConvolver();
  const wet = audio.createGain();
  wet.gain.value = settings.reverb ?? 0.2;
  shelf.connect(convolver).connect(wet).connect(compressor);
  nodes.push(convolver, wet);
  let room = bound(settings.room ?? 1.4, 0.3, 4);
  convolver.buffer = noiseBuffer(audio, room, 2, random, true);
  return {
    input,
    master,
    shelf,
    convolver,
    wet,
    configure(values = {}) {
      for (const [key, param, min, max] of [
        ['volume', master.gain, 0, values.maxVolume ?? 1],
        ['tone', shelf.gain, -40, 40],
        ['frequency', shelf.frequency, 1, 24000],
        ['reverb', wet.gain, 0, 1],
      ]) {
        if (Number.isFinite(values[key])) {
          param.setTargetAtTime(
            bound(values[key], min, max),
            audio.currentTime,
            0.02
          );
        }
      }
      if (Number.isFinite(values.room) && bound(values.room, 0.3, 4) !== room) {
        room = bound(values.room, 0.3, 4);
        convolver.buffer = noiseBuffer(audio, room, 2, random, true);
      }
    },
    disconnect: () => nodes.forEach((node) => node.disconnect()),
  };
}

function sweep(param, from, to, start, duration) {
  param.setValueAtTime(from, start);
  if (to !== from) {
    param.exponentialRampToValueAtTime(to, start + duration);
  }
}

function createEnvelope(audio, envelope, start, peak) {
  const { attack, decay, sustain, release } = envelope;
  const stop = start + attack + decay + release;
  const amp = audio.createGain();
  amp.gain.value = 0;
  amp.gain.setValueAtTime(0, 0);
  amp.gain.setValueAtTime(0, start);
  amp.gain.linearRampToValueAtTime(peak, start + attack);
  if (envelope.curve === 'exponential' && peak > 0) {
    amp.gain.exponentialRampToValueAtTime(
      Math.min(0.0001, peak),
      start + attack + decay
    );
  } else {
    amp.gain.linearRampToValueAtTime(peak * sustain, start + attack + decay);
  }
  amp.gain.linearRampToValueAtTime(0, stop);
  return amp;
}

/** Schedule a parsed voice, returning its final stop time. */
export function playVoice(
  audio,
  voice,
  output,
  {
    at = audio.currentTime,
    pan = 0,
    gain = 1,
    detune = 0,
    random = Math.random,
  } = {}
) {
  let end = at;
  for (let repeat = 0; repeat < voice.repeat; repeat++) {
    for (const part of voice.parts) {
      const start = at + repeat * voice.gap + part.delay;
      const { attack, decay, release } = part.envelope;
      const duration = attack + decay + release;
      const stop = start + duration;
      end = Math.max(end, stop);
      const nodes = [];
      const amp = createEnvelope(
        audio,
        part.envelope,
        start,
        part.gain * gain * voice.repeatDecay ** repeat
      );
      nodes.push(amp);
      let source;
      if (part.kind === 'noise') {
        source = audio.createBufferSource();
        source.buffer = cachedNoise(audio, random);
        source.loop = true;
        source.detune.value = detune;
      } else {
        source = audio.createOscillator();
        source.type = part.wave;
        source.detune.value = part.detune + detune;
        sweep(
          source.frequency,
          part.frequency,
          part.to,
          start,
          part.glide ?? duration
        );
        if (part.fm) {
          const mod = audio.createOscillator();
          const depth = audio.createGain();
          mod.detune.value = detune;
          mod.frequency.value = part.frequency * part.fm.ratio;
          depth.gain.setValueAtTime(part.frequency * part.fm.index, start);
          if (part.fm.index > 0) {
            depth.gain.exponentialRampToValueAtTime(1, start + attack + decay);
          }
          mod.connect(depth).connect(source.frequency);
          mod.start(start);
          mod.stop(stop);
          nodes.push(mod, depth);
        }
      }
      nodes.push(source);
      let tail = source;
      if (part.filter) {
        const filter = audio.createBiquadFilter();
        filter.type = part.filter.type;
        filter.Q.value = part.filter.q;
        sweep(
          filter.frequency,
          part.filter.from,
          part.filter.to,
          start,
          duration
        );
        tail = tail.connect(filter);
        nodes.push(filter);
      }
      tail = tail.connect(amp);
      if (typeof audio.createStereoPanner === 'function') {
        const panner = audio.createStereoPanner();
        panner.pan.value = clamp(pan + part.pan);
        tail = tail.connect(panner);
        nodes.push(panner);
      }
      tail.connect(output);
      source.onended = () => nodes.forEach((node) => node.disconnect());
      startSource(source, part.kind, start, random);
      source.stop(stop);
    }
  }
  return end;
}

function startSource(source, kind, start, random) {
  if (kind === 'noise') {
    source.start(start, random() * 2);
  } else {
    source.start(start);
  }
}
