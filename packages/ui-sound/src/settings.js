import { formatLinks } from '@link-foundation/ui-core';
import { readSchema } from '@link-foundation/ui-settings';

const GLOBAL_FIELDS = [
  ['mode', 'choice', 'random', ['options', 'random', 'cycle', 'layer']],
  ['tone', 'choice', 'neutral', ['options', 'warm', 'neutral', 'bright']],
  ['reverb', 'range', 0.2, ['min', 0], ['max', 1], ['step', 0.01]],
  [
    'room',
    'range',
    1.4,
    ['min', 0.3],
    ['max', 4],
    ['step', 0.1],
    ['visible-when', ['not', ['sound.reverb', '0']]],
  ],
  ['pitchSpread', 'range', 15, ['min', 0], ['max', 100], ['step', 1]],
  ['stereo', 'toggle', true],
  [
    'width',
    'range',
    0.6,
    ['min', 0],
    ['max', 1],
    ['step', 0.01],
    ['visible-when', 'sound.stereo'],
  ],
  ['hoverGap', 'range', 80, ['min', 0], ['max', 500], ['step', 1]],
];
export const SOUND_GLOBAL_KEYS = Object.freeze(
  GLOBAL_FIELDS.map(([key]) => `sound.${key}`)
);
export const soundEventKey = (event, field) => `sound.events.${event}.${field}`;
const LABELS = {
  enabled: 'Sound',
  volume: 'Volume',
  mode: 'Selection mode',
  tone: 'Tone',
  reverb: 'Reverb',
  room: 'Room length',
  pitchSpread: 'Pitch spread',
  stereo: 'Stereo',
  width: 'Stereo width',
  hoverGap: 'Hover gap',
};
const tones = { warm: -7, neutral: 0, bright: 5 };

function field(key, type, value, clauses = []) {
  return {
    id: key,
    values: [
      ['type', type],
      ['default', String(value)],
      ['comfort'],
      ...(LABELS[key.slice(6)] ? [['label', LABELS[key.slice(6)]]] : []),
      ...clauses,
    ],
  };
}

/** Nested LiNo fields, without a schema header, ready to append to a host schema. */
export function generateSoundSettings(
  theme,
  events,
  { slots = 4, maxVolume = 1 } = {}
) {
  validateOptions(theme, slots, maxVolume);
  const fields = [
    field('sound.enabled', 'toggle', false),
    field('sound.volume', 'range', 0.5, [
      ['min', 0],
      ['max', maxVolume],
      ['step', 0.01],
    ]),
    ...GLOBAL_FIELDS.map(([key, type, value, ...clauses]) =>
      field(`sound.${key}`, type, value, clauses)
    ),
  ];
  const names = Object.keys(theme.voices);
  const labels = [
    'option-labels',
    ['none', 'None'],
    ...names.map((name) => [name, theme.voices[name].source.character ?? name]),
  ];
  const seen = new Set();
  for (const entry of events) {
    const { name, label = name } =
      typeof entry === 'string' ? { name: entry } : entry;
    if (typeof name !== 'string' || !name || seen.has(name)) {
      throw new TypeError('Expected unique event names');
    }
    seen.add(name);
    fields.push(...eventFields(theme, name, label, slots, { names, labels }));
  }
  const atoms = (value) =>
    Array.isArray(value) ? value.map(atoms) : String(value);
  return formatLinks(
    fields.map((record) => ({ ...record, values: record.values.map(atoms) }))
  );
}

export function createSoundSettingsSchema(theme, events, options) {
  const result = readSchema(
    `sound-settings: schema\n  version 1\n${generateSoundSettings(theme, events, options)}`
  );
  if (result.diagnostics.some((d) => d.severity === 'error')) {
    throw new TypeError(result.diagnostics.map((d) => d.message).join('\n'));
  }
  return result.schema;
}

/** Read generated keys from any compatible settings binding; unset keys preserve defaults. */
export function runtimeFromConfig(config, theme) {
  if (!config) {
    return {};
  }
  const values = {};
  for (const key of [
    'enabled',
    'volume',
    ...GLOBAL_FIELDS.map(([key]) => key),
  ]) {
    const value = config.get(`sound.${key}`);
    if (value !== undefined) {
      values[key] = key === 'tone' ? (tones[value] ?? value) : value;
    }
  }
  const events = Object.create(null);
  // Generated bindings expose their schema, so consumer-only events also work.
  const names = new Set(Object.keys(theme.events));
  for (const key of config.schema?.fields.keys() ?? []) {
    if (key.startsWith('sound.events.') && key.endsWith('.voice1')) {
      names.add(key.slice('sound.events.'.length, -'.voice1'.length));
    }
  }
  for (const name of names) {
    const binding = eventFromConfig(config, name);
    if (binding) {
      events[name] = binding;
    }
  }
  return { ...values, events };
}

function eventFields(theme, name, label, slots, { names, labels }) {
  const fields = [];
  const binding = Object.hasOwn(theme.events, name)
    ? theme.events[name]
    : undefined;
  for (let slot = 0; slot < slots; slot++) {
    const key = soundEventKey(name, `voice${slot + 1}`);
    fields.push(
      field(key, 'choice', binding?.voices[slot] ?? 'none', [
        ['label', `${label} voice ${slot + 1}`],
        ['options', 'none', ...names],
        labels,
        ['preview', 'sound-voice'],
        ...(slot
          ? [
              [
                'visible-when',
                ['not', [soundEventKey(name, `voice${slot}`), 'none']],
              ],
            ]
          : []),
      ])
    );
  }
  fields.push(
    field(soundEventKey(name, 'level'), 'range', binding?.level ?? 1, [
      ['label', `${label} level`],
      ['min', 0],
      ['max', 2],
      ['step', 0.01],
    ])
  );
  return fields;
}

function eventFromConfig(config, name) {
  const voices = [];
  let configured = false;
  let ended = false;
  for (let slot = 1; slot <= 4; slot++) {
    const voice = config.get(soundEventKey(name, `voice${slot}`));
    if (voice !== undefined) {
      configured = true;
    }
    if (voice === 'none' || voice === undefined) {
      ended = true;
    }
    if (!ended) {
      voices.push(voice);
    }
  }
  const level = config.get(soundEventKey(name, 'level'));
  return configured || level !== undefined
    ? {
        ...(configured ? { voices } : {}),
        ...(level === undefined ? {} : { level }),
      }
    : null;
}

function validateOptions(theme, slots, maxVolume) {
  if (!Number.isInteger(slots) || slots < 1 || slots > 4) {
    throw new RangeError('Expected one to four voice slots');
  }
  if (!Number.isFinite(maxVolume) || maxVolume < 1 || maxVolume > 2) {
    throw new RangeError('Expected maxVolume from one to two');
  }
  if (Object.hasOwn(theme.voices, 'none')) {
    throw new TypeError('The voice name none is reserved by sound settings');
  }
}
