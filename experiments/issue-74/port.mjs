/** Reproduce the data port from the pinned Unlicense source. No audio files. */
import { readFile, writeFile } from 'node:fs/promises';
import { transform } from 'esbuild';
import { formatLinks } from '@link-foundation/ui-core';

const raw = (value) => (Array.isArray(value) ? value.map(raw) : String(value));
const revision = '16a6172c38fc120133485f805c49d980b9850bc4';
// Download sound.ts/settings.ts from this revision with gh api, then pass paths.
const [soundPath, settingsPath] = process.argv.slice(2);
async function loadTs(text) {
  const { code } = await transform(text, { loader: 'ts', format: 'esm' });
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
}
const sound = await readFile(soundPath, 'utf8');
const specs = await loadTs(
  sound.slice(
    sound.indexOf('interface Sweep'),
    sound.indexOf('export interface SoundOptions')
  )
);
const settings = await loadTs(await readFile(settingsPath, 'utf8'));
const envelope = (attack, duration) => [
  'envelope',
  ['curve', 'exponential'],
  ['attack', attack],
  ['decay', duration - attack],
  ['sustain', 0],
  ['release', 0.01],
];
const voices = Object.entries(specs.SOUND_SPECS).map(([id, spec]) => {
  const source = settings.SOUNDS.find((s) => s.id === id);
  return [
    'voice',
    id,
    ...spec.voices.map((v) => [
      'part',
      v.kind === 'tone'
        ? [
            'oscillator',
            v.wave,
            ['frequency', v.freq.from],
            ['glide', v.freq.to, v.duration],
            ...(v.fm ? [['fm', v.fm.ratio, v.fm.index]] : []),
          ]
        : ['noise'],
      envelope(Math.min(v.attack ?? 0.004, v.duration * 0.8), v.duration),
      ['gain', v.gain],
      ...(v.delay ? [['delay', v.delay]] : []),
      ...(v.pan ? [['pan', v.pan]] : []),
      ...(v.detune ? [['detune', v.detune]] : []),
      ...(v.filter
        ? [
            [
              'filter',
              v.filter.type,
              v.filter.freq.from,
              v.filter.freq.to,
              v.filter.q ?? 1,
            ],
          ]
        : []),
    ]),
    ...(spec.repeat
      ? [
          ['repeat', spec.repeat],
          ['gap', spec.gap ?? 0],
          ['repeat-decay', spec.repeatDecay ?? 1],
        ]
      : []),
    [
      'source',
      ['character', source.character],
      ['label', source.sourceLabel],
      ['url', source.sourceUrl],
      ['license', 'Unlicense'],
      [
        'port',
        `https://github.com/konard/immortality/blob/${revision}/app/src/sound.ts`,
      ],
    ],
  ];
});
const events = Object.entries(settings.DEFAULT_SETTINGS.effects).map(
  ([name, ids]) => [
    'event',
    name === 'activate' ? 'click' : name,
    ['mode', 'random'],
    ['voices', ...ids],
    ...(name === 'scan' ? [['throttle', 120]] : []),
  ]
);
await writeFile(
  'packages/ui-sound/themes/immortality.lino',
  formatLinks(
    raw([
      [
        'sound-theme',
        'immortality',
        ...voices,
        ...events,
        ['bus', ['shelf', 3200, 0], ['compressor', -18, 4], ['reverb', 0.2]],
      ],
    ])
  )
);
const quiet = [
  ['tick', 'triangle', 880, 880, 0.002, 0.04, 0.02, 0.02],
  ['soft-open', 'sine', 440, 660, 0.01, 0.12, 0.05, 0.025],
  ['soft-close', 'sine', 660, 440, 0.01, 0.1, 0.04, 0.025],
  ['tap', 'sine', 620, 600, 0.003, 0.04, 0.02, 0.015],
  ['chime', 'sine', 784, 880, 0.015, 0.18, 0.06, 0.02],
].map(([id, wave, from, to, attack, decay, release, gain]) => [
  'voice',
  id,
  ['oscillator', wave, ['frequency', from], ['glide', to, attack + decay]],
  [
    'envelope',
    ['attack', attack],
    ['decay', decay],
    ['sustain', 0],
    ['release', release],
  ],
  ['gain', gain],
  ['source', ['label', 'own work'], ['license', 'CC0-1.0']],
]);
const quietEvents = Object.entries({
  hover: 'tap',
  click: 'tick',
  toggle: 'tick',
  select: 'tap',
  scan: 'tap',
  open: 'soft-open',
  close: 'soft-close',
  type: 'tap',
  intro: 'chime',
  notify: 'chime',
}).map(([name, voice]) => [
  'event',
  name,
  ['mode', 'random'],
  ['voices', voice],
  ...(name === 'scan' ? [['throttle', 120]] : []),
]);
await writeFile(
  'packages/ui-sound/themes/quiet.lino',
  formatLinks(
    raw([
      [
        'sound-theme',
        'quiet',
        ...quiet,
        ...quietEvents,
        ['bus', ['shelf', 4000, -6], ['compressor', -18, 4], ['reverb', 0.15]],
      ],
    ])
  )
);
