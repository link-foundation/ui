/**
 * The control kinds (src/controls/kinds.lino) stay equal to their embedded
 * copy and to the kinds of docs/spec/vocabulary.lino.
 */

import { describe, it, expect } from 'test-anywhere';
import { readFileSync } from 'node:fs';
import { URL } from 'node:url';
import { defaultVocabulary } from '@link-foundation/ui-core';
import {
  CONTROL_KINDS_TEXT,
  controlKindMeta,
  controlKindNames,
  controlsVocabulary,
} from '../../src/controls/vocabulary.js';

const KINDS = new URL('../../src/controls/kinds.lino', import.meta.url);

/** A kind as plain data, for comparison. */
const plain = (kind) => ({
  positional: kind.positional,
  children: kind.children,
  properties: [...kind.properties]
    .filter(([name]) => name !== 'note' && name !== 'machine')
    .map(([name, spec]) => [name, JSON.stringify(spec.type), spec.multi]),
});

describe('control kinds', () => {
  it('embeds kinds.lino byte for byte', () => {
    expect(CONTROL_KINDS_TEXT).toBe(readFileSync(KINDS, 'utf8'));
  });

  it('lists the controls of #34 and their parts', () => {
    expect(controlKindNames()).toEqual([
      'button',
      'icon-button',
      'label',
      'link',
      'text-field',
      'text-area',
      'number-field',
      'color-field',
      'checkbox',
      'radio-group',
      'radio',
      'switch',
      'slider',
      'select',
      'combobox',
      'option',
      'progress',
      'badge',
      'avatar',
    ]);
    expect(controlKindMeta('switch')).toEqual({
      machine: 'switch-machine',
      role: 'switch',
    });
    expect(controlKindMeta('stack')).toBe(undefined);
  });

  it('declares the same kinds as docs/spec/vocabulary.lino', () => {
    const spec = defaultVocabulary().kinds;
    const controls = controlsVocabulary().kinds;
    for (const name of controlKindNames()) {
      expect([name, spec.has(name)]).toEqual([name, true]);
      expect([name, plain(controls.get(name))]).toEqual([
        name,
        plain(spec.get(name)),
      ]);
    }
  });
});
