/**
 * The MUI mapping rules (src/mappings/mui.lino): one case per component and
 * variant, each with its expected LiNo and rule name.
 */

import { describe, it, expect } from 'test-anywhere';
import { importJsx, mappingRules } from '@link-foundation/ui-convert';
import { expectParses } from './helpers.js';

/** [name, JSX, expected LiNo, first applied rule] */
const CASES = [
  [
    'Button contained',
    '<Button variant="contained">Save</Button>',
    '(button-0: button\n  (label Save)\n  (variant filled))\n',
    'mui-button-contained',
  ],
  [
    'Button outlined',
    '<Button variant="outlined">Save</Button>',
    '(button-0: button\n  (label Save)\n  (variant outlined))\n',
    'mui-button-outlined',
  ],
  [
    'Button text',
    '<Button variant="text">Save</Button>',
    '(button-0: button\n  (label Save)\n  (variant text))\n',
    'mui-button-text',
  ],
  [
    'Button without variant',
    '<Button>Save</Button>',
    '(button-0: button\n  (label Save)\n  (variant text))\n',
    'mui-button-default',
  ],
  [
    'Button with an unknown variant',
    '<Button variant="soft">Save</Button>',
    '(button-0: button\n  (label Save)\n  (attr variant soft))\n',
    'mui-button',
  ],
  [
    'Button disabled',
    '<Button variant="contained" disabled>Save</Button>',
    '(button-0: button\n  (label Save)\n  (variant filled)\n  (disabled true))\n',
    'mui-button-contained',
  ],
  [
    'IconButton',
    '<IconButton aria-label="Delete" />',
    '(icon-button-0: icon-button\n  (label Delete))\n',
    'mui-icon-button',
  ],
  [
    'TextField',
    '<TextField label="Email" type="email" required />',
    '(text-field-0: text-field\n  (label Email)\n  (type email)\n  (required true))\n',
    'mui-text-field',
  ],
  [
    'TextField multiline',
    '<TextField label="Notes" multiline rows={4} />',
    '(text-area-0: text-area\n  (label Notes)\n  (rows 4))\n',
    'mui-text-area',
  ],
  [
    'Checkbox',
    '<Checkbox checked />',
    '(checkbox-0: checkbox\n  (checked true))\n',
    'mui-checkbox',
  ],
  [
    'Switch',
    '<Switch disabled />',
    '(switch-0: switch\n  (disabled true))\n',
    'mui-switch',
  ],
  [
    'Typography h1',
    '<Typography variant="h1">Title</Typography>',
    '(text-0: text Title\n  (level 1))\n',
    'mui-typography-h1',
  ],
  [
    'Typography h2',
    '<Typography variant="h2">Title</Typography>',
    '(text-0: text Title\n  (level 2))\n',
    'mui-typography-h2',
  ],
  [
    'Typography h3',
    '<Typography variant="h3">Title</Typography>',
    '(text-0: text Title\n  (level 3))\n',
    'mui-typography-h3',
  ],
  [
    'Typography h4',
    '<Typography variant="h4">Title</Typography>',
    '(text-0: text Title\n  (level 4))\n',
    'mui-typography-h4',
  ],
  [
    'Typography h5',
    '<Typography variant="h5">Title</Typography>',
    '(text-0: text Title\n  (level 5))\n',
    'mui-typography-h5',
  ],
  [
    'Typography h6',
    '<Typography variant="h6">Title</Typography>',
    '(text-0: text Title\n  (level 6))\n',
    'mui-typography-h6',
  ],
  [
    'Typography body1',
    '<Typography variant="body1">Title</Typography>',
    '(text-0: text Title\n  (variant body-large))\n',
    'mui-typography-body1',
  ],
  [
    'Typography body2',
    '<Typography variant="body2">Title</Typography>',
    '(text-0: text Title\n  (variant body-medium))\n',
    'mui-typography-body2',
  ],
  [
    'Typography without variant',
    '<Typography>Title</Typography>',
    '(text-0: text Title\n  (variant body-large))\n',
    'mui-typography-default',
  ],
  [
    'Typography with an unknown variant',
    '<Typography variant="caption">Title</Typography>',
    '(text-0: text Title\n  (attr variant caption))\n',
    'mui-typography',
  ],
  [
    'Stack column',
    '<Stack direction="column" spacing={2} />',
    '(stack-0: stack\n  (direction vertical)\n  (gap (token space.2)))\n',
    'mui-stack-column',
  ],
  [
    'Stack row',
    '<Stack direction="row" spacing={1} />',
    '(stack-0: stack\n  (direction horizontal)\n  (gap (token space.1)))\n',
    'mui-stack-row',
  ],
  [
    'Stack without direction',
    '<Stack spacing={3} />',
    '(stack-0: stack\n  (direction vertical)\n  (gap (token space.3)))\n',
    'mui-stack-default',
  ],
  [
    'Stack with an unmapped direction',
    '<Stack direction="row-reverse" />',
    '(stack-0: stack\n  (attr direction row-reverse))\n',
    'mui-stack',
  ],
  [
    'Box',
    '<Box component="section" />',
    '(box-0: box\n  (attr component section))\n',
    'mui-box',
  ],
  ['Card', '<Card />', '(card-0: card\n  (variant elevated))\n', 'mui-card'],
  [
    'Card outlined',
    '<Card variant="outlined" />',
    '(card-0: card\n  (variant outlined))\n',
    'mui-card-outlined',
  ],
  [
    'CardContent',
    '<CardContent />',
    '(card-content-0: card-content)\n',
    'mui-card-content',
  ],
  [
    'Dialog',
    '<Dialog open />',
    '(dialog-0: dialog\n  (open true))\n',
    'mui-dialog',
  ],
  [
    'Tabs and Tab',
    '<Tabs value="a"><Tab label="A" value="a" /></Tabs>',
    '(tabs-0: tabs\n  (value a)\n  (tab-0-0: tab\n    (label A)\n    (value a)))\n',
    'mui-tabs',
  ],
  [
    'List and ListItem',
    '<List><ListItem>One</ListItem></List>',
    '(list-0: list\n  (list-item-0-0: list-item\n    (text-0-0-0: text One)))\n',
    'mui-list',
  ],
  [
    'AppBar and Toolbar',
    '<AppBar position="static"><Toolbar /></AppBar>',
    '(app-bar-0: app-bar\n  (position static)\n  (toolbar-0-0: toolbar))\n',
    'mui-app-bar',
  ],
];

describe('MUI mapping', () => {
  for (const [name, jsx, lino, rule] of CASES) {
    it(`maps ${name}`, () => {
      const { text, applied, diagnostics } = importJsx(jsx);
      expect(text).toBe(lino);
      expect([...applied.values()][0] ?? null).toBe(rule);
      expect(diagnostics.filter((d) => d.severity !== 'info')).toEqual([]);
      expectParses(text);
    });
  }

  it('has a case for every rule of mui.lino', () => {
    const used = new Set();
    for (const [, jsx] of CASES) {
      for (const rule of importJsx(jsx).applied.values()) {
        used.add(rule);
      }
    }
    const missing = mappingRules('mui')
      .map((rule) => rule.name)
      .filter((name) => !used.has(name));
    expect(missing).toEqual([]);
  });

  it('turns spacing into a space token and keeps other props as attr', () => {
    expect(importJsx('<Stack spacing={4} useFlexGap />').text).toBe(
      '(stack-0: stack\n  (direction vertical)\n  (gap (token space.4))\n  (attr useFlexGap true))\n'
    );
  });
});
