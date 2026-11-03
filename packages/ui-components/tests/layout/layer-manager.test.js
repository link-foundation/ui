/**
 * createLayerManager: the fixed layer order, raise within a layer, and the
 * deepcase-app issue 290 case (a handler window drawn above a modal).
 */

import { describe, it, expect } from 'test-anywhere';
import { createLayerManager, LAYERS } from '@link-foundation/ui-components';

describe('createLayerManager', () => {
  it('keeps every modal above every window, even after raise (deepcase-app#290)', () => {
    const layers = createLayerManager();
    layers.register('confirm-delete', 'modal');
    layers.register('handler-editor', 'window');
    layers.register('handler-list', 'window');
    // The user clicks the handler window behind the modal: it is raised.
    layers.raise('handler-editor');
    layers.raise('handler-list');
    layers.raise('handler-editor');
    for (const win of ['handler-editor', 'handler-list']) {
      expect(layers.zIndexOf(win)).toBeLessThan(
        layers.zIndexOf('confirm-delete')
      );
    }
    // A window opened after the modal is still below it.
    layers.register('late-window', 'window');
    expect(layers.zIndexOf('late-window')).toBeLessThan(
      layers.zIndexOf('confirm-delete')
    );
  });

  it('orders the layers base < dock < window < popover < modal < toast', () => {
    expect(LAYERS).toEqual([
      'base',
      'dock',
      'window',
      'popover',
      'modal',
      'toast',
    ]);
    const layers = createLayerManager();
    // Registered from the top layer down: the order still follows LAYERS.
    [...LAYERS].reverse().forEach((layer) => layers.register(layer, layer));
    expect(layers.order()).toEqual([...LAYERS]);
    const z = LAYERS.map((layer) => layers.zIndexOf(layer));
    expect(z).toEqual([...z].sort((a, b) => a - b));
  });

  it('raises a surface to the top of its own layer only', () => {
    const layers = createLayerManager({ base: 100, step: 10 });
    layers.register('a', 'window');
    layers.register('b', 'window');
    layers.register('tip', 'popover');
    expect(layers.zIndexOf('a')).toBe(100);
    expect(layers.zIndexOf('b')).toBe(110);
    expect(layers.zIndexOf('tip')).toBe(120);
    layers.raise('a');
    expect(layers.zIndexOf('b')).toBe(100);
    expect(layers.zIndexOf('a')).toBe(110);
    expect(layers.zIndexOf('tip')).toBe(120);
  });

  it('notifies listeners on changes and stops after unsubscribe', () => {
    const layers = createLayerManager();
    let calls = 0;
    const unsubscribe = layers.subscribe(() => {
      calls += 1;
    });
    layers.register('a', 'window');
    layers.register('b', 'window');
    layers.raise('b'); // already on top: no change
    layers.raise('a');
    layers.raise('missing');
    expect(calls).toBe(3);
    unsubscribe();
    layers.unregister('a');
    expect(calls).toBe(3);
    expect(Number.isNaN(layers.zIndexOf('a'))).toBe(true);
    expect(layers.layerOf('b')).toBe('window');
  });

  it('moves a surface to another layer when it is registered again', () => {
    const layers = createLayerManager();
    layers.register('panel', 'dock');
    layers.register('win', 'window');
    expect(layers.zIndexOf('panel')).toBeLessThan(layers.zIndexOf('win'));
    layers.register('panel', 'modal');
    expect(layers.zIndexOf('panel')).toBeGreaterThan(layers.zIndexOf('win'));
  });

  it('rejects an unknown layer and a bad step', () => {
    const layers = createLayerManager();
    expect(() => layers.register('x', 'tooltip')).toThrow();
    expect(() => createLayerManager({ step: 0 })).toThrow();
  });
});
