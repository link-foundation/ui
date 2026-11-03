/**
 * Behaviour: `renderLinkSvg` is a pure function of its arguments. Two runs
 * give the same text, and the text matches the stored snapshot
 * (`UPDATE_SNAPSHOTS=1` rewrites it).
 */

import { describe, it, expect } from 'test-anywhere';
import { readFileSync, writeFileSync } from 'node:fs';
import { URL } from 'node:url';
import { linkGeometry } from '../../src/links-view/geometry.js';
import { linkColors } from '../../src/links-view/tokens.js';
import { renderLinkSvg } from '../../src/links-view/render-svg.js';

const SNAPSHOT = new URL('./__snapshots__/render-svg.svg', import.meta.url);

const geometry = linkGeometry({
  source: { x: -80, y: 0 },
  target: { x: 80, y: 0 },
  bend: 0.2,
});

const style = (overrides = {}) => ({
  width: 320,
  height: 200,
  view: { x: 160, y: 100, k: 1 },
  colors: linkColors(),
  ends: { source: 'bar', target: 'arrow' },
  blueprint: true,
  grid: true,
  idPrefix: 'snap',
  ...overrides,
});

/** The snapshot check: one SVG document per case, separated by newlines. */
function matchSnapshot(text) {
  if (process.env.UPDATE_SNAPSHOTS === '1') {
    writeFileSync(SNAPSHOT, text);
  }
  expect(text).toBe(readFileSync(SNAPSHOT, 'utf8'));
}

describe('renderLinkSvg', () => {
  it('gives identical output on two runs', () => {
    const first = renderLinkSvg(geometry, style());
    const second = renderLinkSvg(
      linkGeometry({
        source: { x: -80, y: 0 },
        target: { x: 80, y: 0 },
        bend: 0.2,
      }),
      style()
    );
    expect(second).toBe(first);
  });

  it('matches the stored snapshot (light, dark, self-loop)', () => {
    const cases = [
      renderLinkSvg(geometry, style()),
      renderLinkSvg(geometry, style({ colors: linkColors({ mode: 'dark' }) })),
      renderLinkSvg(
        linkGeometry({ source: { x: 0, y: 40 }, selfLoop: true }),
        style({ blueprint: false, grid: false, ends: { target: 'dot' } })
      ),
    ];
    matchSnapshot(`${cases.join('\n')}\n`);
  });

  it('draws the blueprint points in their roles and colours', () => {
    const colors = linkColors();
    const svg = renderLinkSvg(geometry, style({ colors }));
    const roles = [...svg.matchAll(/data-role="([a-z]+)"/gu)].map((m) => m[1]);
    expect(roles).toEqual([
      'start',
      'point',
      'point',
      'point',
      'center',
      'point',
      'point',
      'point',
      'end',
    ]);
    expect(svg).toContain(
      `data-role="start" cx="-80" cy="0" r="3.4" fill="none" stroke="${colors.blueprintStart}"`
    );
    expect(svg).toContain(`stroke="${colors.blueprintEnd}"`);
    expect(svg).toContain(`stroke="${colors.blueprintCenter}"`);
    expect(svg).toContain(`stroke="${colors.blueprintPoint}"`);
    expect(svg).toContain('stroke-dasharray="4 2"');
  });

  it('leaves out the grid and blueprint when they are off', () => {
    const svg = renderLinkSvg(
      geometry,
      style({ grid: false, blueprint: false })
    );
    expect(svg).not.toContain('data-part="grid');
    expect(svg).not.toContain('data-part="blueprint"');
    expect(svg).toContain('data-part="line"');
  });

  it('hides itself from assistive technology (the element is labelled)', () => {
    const svg = renderLinkSvg(geometry, style());
    expect(svg.startsWith('<svg ')).toBe(true);
    expect(svg).toContain('aria-hidden="true"');
  });

  it('escapes colour text in attributes', () => {
    const colors = { ...linkColors(), line: 'red" onload="x' };
    const svg = renderLinkSvg(geometry, style({ colors }));
    expect(svg).not.toContain('" onload="');
    expect(svg).toContain('red&quot; onload=&quot;x');
  });
});
