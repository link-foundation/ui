/** Sound graphs are data read by the official LiNo reader in ui-core. */
import { parseLinks } from '@link-foundation/ui-core';

const WAVES = ['sine', 'triangle', 'square', 'sawtooth'];
const FILTERS = [
  'lowpass',
  'highpass',
  'bandpass',
  'notch',
  'allpass',
  'peaking',
  'lowshelf',
  'highshelf',
];

function createReader(diagnostics) {
  const report = (code, message) =>
    diagnostics.push({ code, severity: 'error', message });
  const number = (value, min, max, fallback = min) => {
    const n =
      typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
    if (!Number.isFinite(n) || n < min || n > max) {
      report('invalid-number', `Expected ${min}..${max}, got ${String(value)}`);
      return fallback;
    }
    return n;
  };
  const choice = (value, choices) => {
    if (!choices.includes(value)) {
      report('invalid-choice', `Unknown choice ${String(value)}`);
    }
    return choices.includes(value) ? value : choices[0];
  };
  const clauses = (items, handlers) => {
    const seen = new Set();
    for (const item of items) {
      if (!Array.isArray(item) || typeof item[0] !== 'string') {
        report('invalid-clause', 'Expected a named clause');
        continue;
      }
      const [key, ...args] = item;
      if (!Object.hasOwn(handlers, key)) {
        report('unknown-key', `Unknown sound key ${key}`);
      } else {
        if (seen.has(key) && !['voice', 'event', 'part'].includes(key)) {
          report('duplicate-key', `Duplicate ${key}`);
        }
        seen.add(key);
        handlers[key](args);
      }
    }
  };
  const envelope = (args) => {
    const e = { attack: 0.004, decay: 0.08, sustain: 0, release: 0.01 };
    clauses(args, {
      curve: ([curve]) => {
        e.curve = choice(curve, ['linear', 'exponential']);
      },
      ...Object.fromEntries(
        Object.keys(e).map((key) => [
          key,
          ([v]) => {
            e[key] = number(v, 0, key === 'sustain' ? 1 : 10);
          },
        ])
      ),
    });
    return e;
  };
  const filter = ([type, from, to = from, q = '1']) => ({
    type: choice(type, FILTERS),
    from: number(from, 1, 24000),
    to: number(to, 1, 24000),
    q: number(q, 0.0001, 100),
  });
  const part = (args) => {
    const p = {
      kind: 'tone',
      wave: 'sine',
      frequency: 440,
      to: 440,
      glide: null,
      gain: 1,
      delay: 0,
      pan: 0,
      detune: 0,
      envelope: { attack: 0.004, decay: 0.08, sustain: 0, release: 0.01 },
    };
    let hasSource = false;
    clauses(args, {
      oscillator: ([wave, ...fields]) => {
        hasSource = true;
        p.wave = choice(wave, WAVES);
        clauses(fields, {
          frequency: ([v]) => {
            p.frequency = p.to = number(v, 1, 24000);
          },
          glide: ([to, seconds]) => {
            p.to = number(to, 1, 24000);
            p.glide = number(seconds, 0, 10);
          },
          fm: ([ratio, index]) => {
            p.fm = {
              ratio: number(ratio, 0.001, 100),
              index: number(index, 0, 100),
            };
          },
        });
      },
      noise: (fields) => {
        hasSource = true;
        p.kind = 'noise';
        if (fields.length) {
          report('unknown-key', 'noise takes no arguments');
        }
      },
      envelope: (fields) => {
        p.envelope = envelope(fields);
      },
      filter: (fields) => {
        p.filter = filter(fields);
      },
      gain: ([v]) => {
        p.gain = number(v, 0, 1);
      },
      delay: ([v]) => {
        p.delay = number(v, 0, 10);
      },
      pan: ([v]) => {
        p.pan = number(v, -1, 1);
      },
      detune: ([v]) => {
        p.detune = number(v, -4800, 4800);
      },
    });
    if (!hasSource) {
      report('missing-source', 'A graph part needs oscillator or noise');
    }
    return p;
  };
  return { report, number, choice, clauses, part };
}

function readVoice([name, ...args], theme, reader) {
  const { report, number, clauses, part } = reader;
  if (typeof name !== 'string' || Object.hasOwn(theme.voices, name)) {
    report('invalid-voice', 'Missing or duplicate voice name');
    return;
  }
  const v = { parts: [], repeat: 1, gap: 0, repeatDecay: 1, source: {} };
  const direct = [];
  for (const arg of args) {
    if (
      Array.isArray(arg) &&
      [
        'oscillator',
        'noise',
        'envelope',
        'filter',
        'gain',
        'delay',
        'pan',
        'detune',
      ].includes(arg[0])
    ) {
      direct.push(arg);
    } else {
      clauses([arg], {
        part: (fields) => {
          v.parts.push(part(fields));
        },
        repeat: ([n]) => {
          v.repeat = number(n, 1, 8);
          if (!Number.isInteger(v.repeat)) {
            report('invalid-repeat', 'repeat must be an integer');
          }
        },
        gap: ([n]) => {
          v.gap = number(n, 0, 10);
        },
        'repeat-decay': ([n]) => {
          v.repeatDecay = number(n, 0, 1);
        },
        source: (fields) =>
          clauses(
            fields,
            Object.fromEntries(
              ['label', 'license', 'character', 'url', 'port'].map((key) => [
                key,
                ([value]) => {
                  if (typeof value !== 'string' || !value) {
                    report('invalid-source', `Missing source ${key}`);
                  } else {
                    v.source[key] = value;
                  }
                },
              ])
            )
          ),
      });
    }
  }
  if (direct.length) {
    v.parts.unshift(part(direct));
  }
  if (v.parts.length === 0 || v.parts.length > 8) {
    report('invalid-parts', 'A voice needs 1..8 parts');
  }
  if (!v.source.label || !v.source.license) {
    report(
      'missing-provenance',
      `Voice ${name} needs a source label and license`
    );
  }
  theme.voices[name] = v;
}

/** Parse and validate a theme. Invalid input produces diagnostics, never a throw. */
export function readSoundTheme(text) {
  const diagnostics = [];
  const reader = createReader(diagnostics);
  const { report, number, choice, clauses } = reader;
  const theme = {
    name: '',
    voices: Object.create(null),
    events: Object.create(null),
    bus: { shelf: [4000, -6], compressor: [-18, 4], reverb: 0.15 },
  };
  try {
    const roots = parseLinks(text, { maxInputSize: 131072, maxDepth: 32 });
    if (
      roots.length !== 1 ||
      !Array.isArray(roots[0]) ||
      roots[0][0] !== 'sound-theme'
    ) {
      report('invalid-theme', 'Expected one sound-theme');
    } else {
      const [, name, ...args] = roots[0];
      if (typeof name !== 'string') {
        report('invalid-theme', 'Expected theme name');
      } else {
        theme.name = name;
      }
      clauses(args, {
        voice: (args) => readVoice(args, theme, reader),
        event: ([event, ...fields]) => {
          if (typeof event !== 'string' || Object.hasOwn(theme.events, event)) {
            report('invalid-event', 'Missing or duplicate event name');
            return;
          }
          const binding = {
            mode: 'random',
            voices: [],
            throttle: event === 'scan' ? 120 : 0,
          };
          clauses(fields, {
            mode: ([mode]) => {
              binding.mode = choice(mode, ['random', 'cycle', 'layer']);
            },
            voices: (names) => {
              binding.voices = names;
              if (names.length > 6) {
                report('too-many-voices', 'An event allows at most six voices');
              }
            },
            throttle: ([ms]) => {
              binding.throttle = number(ms, 0, 60000);
            },
          });
          theme.events[event] = binding;
        },
        bus: (fields) =>
          clauses(fields, {
            shelf: ([hz, db]) => {
              theme.bus.shelf = [number(hz, 1, 24000), number(db, -40, 40)];
            },
            compressor: ([db, ratio]) => {
              theme.bus.compressor = [
                number(db, -100, 0),
                number(ratio, 1, 20),
              ];
            },
            reverb: ([v]) => {
              theme.bus.reverb = number(v, 0, 1);
            },
          }),
      });
    }
    for (const binding of Object.values(theme.events)) {
      for (const name of binding.voices) {
        if (typeof name !== 'string' || !Object.hasOwn(theme.voices, name)) {
          report('unknown-voice', `Unknown voice ${String(name)}`);
        }
      }
    }
  } catch (error) {
    diagnostics.push(
      ...(error.diagnostics ?? [
        {
          code: 'invalid-theme',
          severity: 'error',
          message: String(error.message),
        },
      ])
    );
  }
  return { theme: diagnostics.length ? null : theme, diagnostics };
}
