/**
 * dock-model: read a dock from Links Notation, change it, write it back,
 * and read it again to the same model.
 */

import { describe, it, expect } from 'test-anywhere';
import { Parser } from 'links-notation';
import { parse } from '@link-foundation/ui-core';
import {
  activatePanel,
  closePanel,
  dockLayoutFromLinks,
  dockLayoutToLino,
  findPanel,
  floatPanel,
  layoutVocabulary,
  movePanel,
  openPanelIds,
  restorePanel,
  updateRegion,
} from '@link-foundation/ui-components';

const DESIGNER = `(designer-shell: dock
  (persist 'designer.layout')
  (left: region (size 16rem) (panels toolbox outline))
  (right: region (size 20rem) (panels properties))
  (center: region (panels canvas))
  (bottom: region (size 12rem) (collapsed true) (panels problems)))`;

const roundTrip = (layout) => dockLayoutFromLinks(dockLayoutToLino(layout));

describe('dockLayoutFromLinks', () => {
  it('reads the regions of the issue sample', () => {
    const layout = dockLayoutFromLinks(DESIGNER);
    expect(layout.id).toBe('designer-shell');
    expect(layout.persist).toBe('designer.layout');
    expect(layout.regions.map((r) => [r.id, r.side, r.size])).toEqual([
      ['left', 'left', '16rem'],
      ['right', 'right', '20rem'],
      ['center', 'center', null],
      ['bottom', 'bottom', '12rem'],
    ]);
    expect(layout.regions[0].panels).toEqual(['toolbox', 'outline']);
    expect(layout.regions[0].active).toBe('toolbox');
    expect(layout.regions[3].collapsed).toBe(true);
    expect(layout.floating).toEqual([]);
    expect(layout.closed).toEqual([]);
  });

  it('reads links-notation links and ui-core documents the same way', () => {
    const fromText = dockLayoutFromLinks(DESIGNER);
    expect(dockLayoutFromLinks(new Parser().parse(DESIGNER))).toEqual(fromText);
    const doc = parse(`(page: document ${DESIGNER})`, {
      vocabulary: layoutVocabulary(),
    });
    expect(doc.diagnostics).toEqual([]);
    expect(dockLayoutFromLinks(doc)).toEqual(fromText);
  });

  it('throws without a dock', () => {
    expect(() => dockLayoutFromLinks('(a: stack)')).toThrow();
    expect(() => dockLayoutFromLinks(DESIGNER, { id: 'other' })).toThrow();
  });
});

describe('dockLayoutToLino', () => {
  it('writes the moved panel into its new region (issue 36 example)', () => {
    const moved = movePanel(dockLayoutFromLinks(DESIGNER), 'outline', 'right');
    const text = dockLayoutToLino(moved);
    expect(text).toContain(
      '(right: region (size 20rem) (panels properties outline))'
    );
    expect(text).toContain('(left: region (size 16rem) (panels toolbox))');
    expect(text).toBe(`(designer-shell: dock
  (persist designer.layout)
  (left: region (size 16rem) (panels toolbox))
  (right: region (size 20rem) (panels properties outline))
  (center: region (panels canvas))
  (bottom: region (size 12rem) (collapsed true) (panels problems)))
`);
  });

  it('parse → movePanel → dockLayoutToLino → parse gives an equal model', () => {
    const moved = movePanel(dockLayoutFromLinks(DESIGNER), 'outline', 'right');
    expect(roundTrip(moved)).toEqual(moved);
  });

  it('round-trips floating, closed, active, quoted names and new regions', () => {
    let layout = dockLayoutFromLinks(DESIGNER);
    layout = movePanel(layout, 'problems', { region: 'top', index: 0 });
    layout = floatPanel(layout, 'toolbox', { x: 40, y: 60 });
    layout = closePanel(layout, 'properties');
    layout = movePanel(layout, 'outline', {
      region: 'center',
      index: 0,
      activate: false,
    });
    layout = activatePanel(layout, 'canvas');
    layout = updateRegion(layout, 'left', { size: '18rem', collapsed: true });
    layout = {
      ...layout,
      regions: layout.regions.map((r) =>
        r.id === 'center' ? { ...r, panels: [...r.panels, 'my panel'] } : r
      ),
    };
    const text = dockLayoutToLino(layout);
    expect(text).toContain(
      '(float toolbox (x 40) (y 60) (width 320) (height 240) (region left))'
    );
    expect(text).toContain('(closed properties right)');
    expect(text).toContain("(panels outline canvas 'my panel')");
    expect(text).toContain('(active canvas)');
    expect(roundTrip(layout)).toEqual(layout);
  });
});

describe('panel operations', () => {
  const base = () => dockLayoutFromLinks(DESIGNER);

  it('moves a panel within its region (reorder) and keeps the shown tab', () => {
    const layout = movePanel(base(), 'outline', { region: 'left', index: 0 });
    expect(layout.regions[0].panels).toEqual(['outline', 'toolbox']);
    expect(layout.regions[0].active).toBe('toolbox');
  });

  it('shows the next tab when the shown panel leaves', () => {
    const layout = movePanel(base(), 'toolbox', 'center');
    expect(layout.regions[0].active).toBe('outline');
    expect(layout.regions[2].panels).toEqual(['canvas', 'toolbox']);
    expect(layout.regions[2].active).toBe('canvas');
  });

  it('floats a panel and docks it again', () => {
    const floated = floatPanel(base(), 'outline');
    expect(findPanel(floated, 'outline')).toEqual({
      place: 'floating',
      floating: {
        panel: 'outline',
        x: 48,
        y: 48,
        width: 320,
        height: 240,
        region: 'left',
      },
      index: 0,
    });
    const moved = floatPanel(floated, 'outline', { x: 100 });
    expect(moved.floating[0].x).toBe(100);
    expect(moved.floating[0].region).toBe('left');
    const docked = movePanel(moved, 'outline', 'right');
    expect(docked.floating).toEqual([]);
    expect(docked.regions[1].panels).toEqual(['properties', 'outline']);
  });

  it('closes and restores a panel to its region as the shown tab', () => {
    const closed = closePanel(base(), 'toolbox');
    expect(openPanelIds(closed)).not.toContain('toolbox');
    expect(closed.closed).toEqual([{ panel: 'toolbox', region: 'left' }]);
    expect(closePanel(closed, 'toolbox')).toBe(closed);
    const restored = restorePanel(closed, 'toolbox');
    expect(restored.closed).toEqual([]);
    expect(restored.regions[0].panels).toEqual(['outline', 'toolbox']);
    expect(restored.regions[0].active).toBe('toolbox');
    const elsewhere = restorePanel(closed, 'toolbox', 'bottom');
    expect(elsewhere.regions[3].panels).toEqual(['problems', 'toolbox']);
  });

  it('leaves its input unchanged', () => {
    const layout = base();
    const before = JSON.stringify(layout);
    movePanel(layout, 'outline', 'right');
    floatPanel(layout, 'toolbox');
    closePanel(layout, 'canvas');
    expect(JSON.stringify(layout)).toBe(before);
  });

  it('rejects unknown panels and regions', () => {
    expect(() => movePanel(base(), 'missing', 'left')).toThrow();
    expect(() => movePanel(base(), 'outline', 'nowhere')).toThrow();
    expect(() => movePanel(base(), 'outline', 42)).toThrow();
    expect(() => updateRegion(base(), 'nowhere', {})).toThrow();
  });
});
