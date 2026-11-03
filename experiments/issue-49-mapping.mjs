import { URL } from 'node:url';
import { writeFile } from 'node:fs/promises';
import { formatLinks } from '@link-foundation/ui-core';
const rows = [
  [
    'Button',
    'button',
    [
      ['appearance', 'primary', ['variant', 'filled']],
      ['appearance', 'secondary', ['variant', 'secondary']],
      ['appearance', 'outline', ['variant', 'outlined']],
      ['appearance', 'subtle', ['variant', 'text']],
      ['appearance', 'transparent', ['variant', 'transparent']],
      ['disabled', 'true', ['disabled', 'true']],
    ],
    'mapped',
    '',
  ],
  [
    'ToggleButton',
    'button',
    [],
    'partial',
    'The application owns checked state and toggle behavior; no automatic checked prop conversion.',
  ],
  [
    'Input',
    'text-field',
    [
      ['value', '*', ['value', '*']],
      ['placeholder', '*', ['placeholder', '*']],
    ],
    'mapped',
    '',
  ],
  ['Textarea', 'text-area', [['value', '*', ['value', '*']]], 'mapped', ''],
  [
    'Checkbox',
    'checkbox',
    [
      ['checked', 'true', ['checked', 'true']],
      ['checked', 'mixed', ['checked', 'mixed']],
    ],
    'mapped',
    '',
  ],
  [
    'RadioGroup',
    'radio-group',
    [
      ['value', '*', ['value', '*']],
      ['layout', 'horizontal', ['orientation', 'horizontal']],
    ],
    'mapped',
    'Use radio children with label/value.',
  ],
  [
    'Switch',
    'switch',
    [['checked', 'true', ['checked', 'true']]],
    'mapped',
    '',
  ],
  [
    'Slider',
    'slider',
    [
      ['value', '*', ['value', '*']],
      ['min', '*', ['min', '*']],
      ['max', '*', ['max', '*']],
      ['step', '*', ['step', '*']],
    ],
    'mapped',
    '',
  ],
  [
    'Dropdown',
    'select',
    [['selectedOptions', '*', ['value', '*']]],
    'partial',
    'Single selection only.',
  ],
  [
    'Combobox',
    'combobox',
    [['value', '*', ['value', '*']]],
    'partial',
    'Multiple selection requires application handling.',
  ],
  ['Dialog', 'dialog', [['open', 'true', ['open', 'true']]], 'mapped', ''],
  ['Menu', 'menu', [], 'mapped', ''],
  ['Tooltip', 'tooltip', [['content', '*', ['label', '*']]], 'mapped', ''],
  ['Toast', 'toast', [], 'mapped', ''],
  ['Drawer', 'drawer', [['open', 'true', ['open', 'true']]], 'mapped', ''],
  [
    'TabList',
    'tabs',
    [['selectedValue', '*', ['active', '*']]],
    'mapped',
    'Map the selected value to the corresponding tab element ID.',
  ],
  [
    'Card',
    'stack',
    [],
    'partial',
    'Use a stack for static cards; interactive card selection needs application behavior.',
  ],
  ['Avatar', 'avatar', [['name', '*', ['name', '*']]], 'mapped', ''],
  [
    'Badge',
    'badge',
    [['color', 'brand', ['tone', 'primary']]],
    'partial',
    'Fluent appearance palette is not automatically converted.',
  ],
  [
    'Spinner',
    'progress',
    [],
    'partial',
    'Indeterminate progress uses the existing progress kind; circular spinner anatomy is not implemented.',
  ],
];
await writeFile(
  new URL(
    '../packages/ui-themes/themes/fluent2/fluent-mapping.lino',
    import.meta.url
  ),
  formatLinks(
    rows.map(([component, kind, props, status, note]) => [
      'map',
      component,
      ['kind', kind],
      ...props.map((p) => ['prop', ...p]),
      ['status', status],
      ...(note ? [['note', note]] : []),
    ])
  )
);
