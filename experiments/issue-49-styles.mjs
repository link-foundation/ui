import { URL } from 'node:url';
/** Author the Fluent style data through the canonical nested formatter. */
import { writeFile } from 'node:fs/promises';
import { formatLinks } from '@link-foundation/ui-core';
const ref = (path) => ['token', path];
const fluent = (suffix) => ref(`fluent.${suffix}`);
const rule = (kind, part, props, body) => [
  'style',
  ['selector', ['type', kind], ...(part ? [['part', part]] : []), ...props],
  ...body,
];
const colorStates = (fg, bg) => [
  ['color', ref(fg)],
  ['background', ref(bg)],
  ...[
    ['hover', 'hover'],
    ['pressed', 'pressed'],
  ].map(([state, suffix]) => [
    'state',
    state,
    ['background', ref(`${bg}-${suffix}`)],
    [
      'color',
      ref(
        fg === 'color.on-primary'
          ? fg
          : fg === 'color.on-surface'
            ? `fluent.color-neutral-foreground1-${suffix}`
            : `${fg}-${suffix}`
      ),
    ],
  ]),
  [
    'state',
    'disabled',
    ['background', fluent('color-neutral-background-disabled')],
    ['color', fluent('color-neutral-foreground-disabled')],
    ['opacity', '1'],
  ],
];
const styles = [];
for (const [variant, bg, fg, border] of [
  ['filled', 'color.primary', 'color.on-primary', false],
  ['secondary', 'color.surface', 'color.on-surface', true],
  ['outlined', 'fluent.color-transparent-background', 'color.on-surface', true],
  ['text', 'fluent.color-subtle-background', 'color.on-surface', false],
  [
    'transparent',
    'fluent.color-transparent-background',
    'fluent.color-brand-foreground1',
    false,
  ],
]) {
  const body = colorStates(fg, bg).map((item) => {
    // Semantic paths' state aliases keep the original Fluent namespace.
    const fix = (raw) =>
      Array.isArray(raw)
        ? raw.map(fix)
        : ({
            'color.primary-hover': 'fluent.color-brand-background-hover',
            'color.primary-pressed': 'fluent.color-brand-background-pressed',
            'color.surface-hover': 'fluent.color-neutral-background1-hover',
            'color.surface-pressed': 'fluent.color-neutral-background1-pressed',
          }[raw] ?? raw);
    return fix(item);
  });
  body.push(
    ['radius', ref('shape.corner.small')],
    ['padding', '6px', '12px'],
    ['border-width', '1px']
  );
  if (border) {
    body.push(['border-color', fluent('color-neutral-stroke1')]);
  }
  body.push(
    ['elevation', '0'],
    ['state', 'hover', ['elevation', '0']],
    ['state', 'pressed', ['elevation', '0']]
  );
  if (variant === 'filled') {
    styles.push(rule('button', 'root', [], body));
  }
  styles.push(rule('button', 'root', [['variant', variant]], body));
}
styles.push(
  rule(
    'text-field',
    'input',
    [],
    [
      ['background', ref('color.surface')],
      ['color', ref('color.on-surface')],
      ['radius', ref('shape.corner.small')],
      ['border-color', ref('color.outline')],
      [
        'state',
        'hover',
        ['border-color', fluent('color-neutral-stroke-accessible-hover')],
      ],
      [
        'state',
        'pressed',
        ['border-color', fluent('color-neutral-stroke-accessible-pressed')],
      ],
      [
        'state',
        'disabled',
        ['color', fluent('color-neutral-foreground-disabled')],
        ['background', fluent('color-neutral-background-disabled')],
        ['opacity', '1'],
      ],
    ]
  )
);
for (const kind of ['checkbox', 'radio', 'switch', 'slider']) {
  styles.push(
    rule(
      kind,
      null,
      [],
      [
        ['color', ref('color.on-surface')],
        [
          'state',
          'hover',
          ['color', fluent('color-neutral-foreground1-hover')],
        ],
        [
          'state',
          'pressed',
          ['color', fluent('color-neutral-foreground1-pressed')],
        ],
        [
          'state',
          'disabled',
          ['color', fluent('color-neutral-foreground-disabled')],
          ['opacity', '1'],
        ],
      ]
    )
  );
}
for (const [kind, part] of [
  ['checkbox', 'indicator'],
  ['radio', 'indicator'],
  ['switch', 'track'],
]) {
  styles.push(
    rule(
      kind,
      part,
      [],
      [
        [
          'state',
          'checked',
          ['background', fluent('color-compound-brand-background')],
          ['border-color', fluent('color-compound-brand-background')],
          ['color', fluent('color-neutral-foreground-inverted')],
          [
            'state',
            'disabled',
            ['background', fluent('color-neutral-background-disabled')],
            ['border-color', fluent('color-neutral-stroke-disabled')],
            ['color', fluent('color-neutral-foreground-disabled')],
          ],
          [
            'state',
            'hover',
            ['background', fluent('color-compound-brand-background-hover')],
          ],
          [
            'state',
            'pressed',
            ['background', fluent('color-compound-brand-background-pressed')],
          ],
        ],
      ]
    )
  );
}
styles.push(
  rule(
    'switch',
    'thumb',
    [],
    [
      [
        'state',
        'checked',
        ['background', fluent('color-neutral-foreground-inverted')],
      ],
    ]
  )
);
for (const part of ['thumb', 'indicator']) {
  styles.push(
    rule(
      'slider',
      part,
      [],
      [['background', fluent('color-compound-brand-background')]]
    )
  );
}
// Visual parts inherit the host's interactions while native inputs retain semantics.
for (const [kind, part, fill] of [
  ['checkbox', 'indicator', false],
  ['radio', 'indicator', false],
  ['switch', 'track', false],
  ['slider', 'thumb', true],
]) {
  styles.push(
    rule(
      kind,
      part,
      [],
      [
        [
          'state',
          'hover',
          [
            fill ? 'background' : 'border-color',
            fluent(
              fill
                ? 'color-compound-brand-background-hover'
                : 'color-neutral-stroke-accessible-hover'
            ),
          ],
        ],
        [
          'state',
          'pressed',
          [
            fill ? 'background' : 'border-color',
            fluent(
              fill
                ? 'color-compound-brand-background-pressed'
                : 'color-neutral-stroke-accessible-pressed'
            ),
          ],
        ],
        [
          'state',
          'disabled',
          ['background', fluent('color-neutral-background-disabled')],
          ['border-color', fluent('color-neutral-stroke-disabled')],
          ['color', fluent('color-neutral-foreground-disabled')],
        ],
      ]
    )
  );
}
for (const [kind, part] of [
  ['button', 'root'],
  ['text-field', 'input'],
  ['checkbox', 'input'],
  ['radio', 'input'],
  ['switch', 'input'],
  ['slider', 'thumb'],
]) {
  styles.push(
    rule(
      kind,
      part,
      [],
      [
        [
          'state',
          'focus',
          ['outline-width', '2px'],
          ['outline-style', 'solid'],
          ['outline-color', ref('color.on-surface')],
          ['outline-offset', '2px'],
        ],
      ]
    )
  );
}
await writeFile(
  new URL('../packages/ui-themes/themes/fluent2/styles.lino', import.meta.url),
  formatLinks([{ id: 'fluent2-styles', values: ['theme', ...styles] }])
);
