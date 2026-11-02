/**
 * Adaptive Cards interop: the official samples round-trip, cards are
 * downgraded with `fallback` and diagnostics, and host configs become
 * themes.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  ADAPTIVE_CARDS_VERSION,
  exportAdaptiveCard,
  hostColour,
  hostConfigToTheme,
  hostConfigToThemeDetails,
  importAdaptiveCard,
} from '../src/index.js';
import {
  codes,
  errors,
  fixture,
  fixtureNames,
  parseLino,
  reformat,
} from './helpers.js';

const CARDS = fixtureNames('adaptive-cards').filter(
  (n) => !n.startsWith('hc-')
);

describe('Adaptive Cards samples', () => {
  for (const name of CARDS) {
    const card = fixture('adaptive-cards', name);
    const imported = importAdaptiveCard(card);

    it(`${name}: export(import(x)) deep-equals x`, () => {
      expect(errors(imported.diagnostics)).toEqual([]);
      const exported = exportAdaptiveCard(imported.lino);
      expect(exported.diagnostics).toEqual([]);
      expect(exported.json).toEqual(card);
    });

    it(`${name}: serialize(parse(lino)) is stable`, () => {
      expect(parseLino(imported.lino).diagnostics).toEqual([]);
      expect(reformat(imported.lino)).toBe(imported.lino);
    });
  }
});

describe('Adaptive Cards versions', () => {
  const text = (value) => ({ type: 'TextBlock', text: value, wrap: true });
  const table = {
    ...fixture('adaptive-cards', 'Table.json').body[0],
    fallback: text('The table needs a newer client.'),
  };
  const card = {
    type: 'AdaptiveCard',
    version: '1.6',
    metadata: { webUrl: 'https://example.com/card' },
    fallbackText: 'Open the card in a newer client.',
    body: [text('Report'), table],
  };
  const { lino } = importAdaptiveCard(card);
  const exportTo = (targetVersion) =>
    exportAdaptiveCard(lino, { targetVersion });

  it('round-trips the card at its own version', () => {
    expect(ADAPTIVE_CARDS_VERSION).toBe('1.6');
    expect(exportTo('1.6')).toEqual({ json: card, diagnostics: [] });
  });

  it('replaces a Table with its fallback for 1.4, with a diagnostic', () => {
    const { json, diagnostics } = exportTo('1.4');
    expect(json.version).toBe('1.4');
    expect(json.body).toEqual([text('Report'), table.fallback]);
    expect(json.fallbackText).toBe(card.fallbackText);
    const fallback = diagnostics.find((d) => d.code === 'version-fallback');
    expect(fallback.severity).toBe('warning');
    expect(fallback.at.path).toBe('/body/1');
    expect(fallback.message).toContain('Table');
  });

  it('keeps a Table for 1.5 and drops the 1.6 properties', () => {
    // The official 1.6 schema marks Table as "version": "1.5".
    const { json, diagnostics } = exportTo('1.5');
    expect(json.body[1].type).toBe('Table');
    expect(json.metadata).toBeUndefined();
    expect(codes(diagnostics)).toEqual(['version-drop-property']);
    expect(diagnostics[0].at.path).toBe('/metadata');
  });

  it('drops an element without a fallback and keeps fallbackText', () => {
    const plain = {
      ...card,
      body: [fixture('adaptive-cards', 'Table.json').body[0]],
    };
    const out = exportAdaptiveCard(importAdaptiveCard(plain).lino, {
      targetVersion: '1.4',
    });
    expect(out.json.body).toEqual([]);
    expect(out.json.fallbackText).toBe(plain.fallbackText);
    expect(codes(out.diagnostics)).toContain('version-drop');
  });

  it('keeps unknown properties in extra', () => {
    const future = {
      type: 'AdaptiveCard',
      version: '1.6',
      body: [{ ...text('Hi'), futureStyle: { glow: true } }],
    };
    const imported = importAdaptiveCard(future);
    expect(imported.lino).toContain('(extra adaptive-cards');
    expect(exportAdaptiveCard(imported.lino).json).toEqual(future);
  });

  it('rejects input that is not a card', () => {
    const { lino, diagnostics } = importAdaptiveCard({ type: 'Message' });
    expect(lino).toBe('');
    expect(errors(diagnostics).length).toBe(1);
  });
});

describe('hostConfigToTheme', () => {
  const tokens = (lino) =>
    Object.fromEntries(
      parseLino(lino)
        .roots[0].properties.filter((p) => p.name === 'token')
        .map((p) => p.values)
    );

  it('maps colours, spacing and fonts of the sample host config', () => {
    const lino = hostConfigToTheme(fixture('adaptive-cards', 'hc-sample.json'));
    const theme = tokens(lino);
    expect(theme['color.default.background']).toBe('#FFFFFF');
    expect(theme['color.default.accent']).toBe('#0063B1');
    expect(theme['space.default']).toBe('8px');
    expect(theme['space.padding']).toBe('10px');
    expect(theme['font.default.size.default']).toBe('14px');
    expect(theme['font.default.weight.bolder']).toBe('600');
    expect(theme['font.monospace.family']).toBe(
      "'Courier New', Courier, monospace"
    );
  });

  it('maps the Microsoft Teams host config', () => {
    const theme = tokens(
      hostConfigToTheme(fixture('adaptive-cards', 'hc-teams.json'))
    );
    expect(theme['color.default.accent']).toBe('#6264A7');
    expect(theme['space.default']).toBe('12px');
    expect(theme['font.default.size.default']).toBe('14px');
  });

  it('writes a theme the interop vocabulary parses cleanly', () => {
    for (const name of ['hc-sample.json', 'hc-teams.json']) {
      const { lino, unmapped } = hostConfigToThemeDetails(
        fixture('adaptive-cards', name)
      );
      expect(parseLino(lino).diagnostics).toEqual([]);
      expect(reformat(lino)).toBe(lino);
      expect(Array.isArray(unmapped)).toBe(true);
    }
  });

  it('reads #AARRGGBB host colours as #RRGGBBAA', () => {
    expect(hostColour('#DD028A02')).toBe('#028A02DD');
    expect(hostColour('#0063B1')).toBe('#0063B1');
  });
});
