import { it } from 'node:test';
import assert from 'node:assert/strict';
import { networkToRaster, networkToPng } from '../../src/links-view/export.js';

function environment(width = 100, height = 60) {
  const calls = [];
  const context = {
    fillRect(...args) {
      calls.push(['fill', this.fillStyle, ...args]);
    },
    drawImage() {
      calls.push(['image']);
    },
  };
  return {
    calls,
    URL: {
      createObjectURL: () => 'blob:test',
      revokeObjectURL: (url) => calls.push(['revoke', url]),
    },
    Image: class {
      width = width;
      height = height;
      set src(value) {
        this.onload(value);
      }
    },
    document: {
      createElement() {
        calls.push(['canvas']);
        return {
          getContext: () => context,
          toBlob: (fn, type) => fn(new globalThis.Blob(['raster'], { type })),
        };
      },
    },
  };
}
it('exports PNG, WebP and JPEG from the identical SVG, adding only the requested JPEG matte', async () => {
  for (const type of ['image/png', 'image/webp', 'image/jpeg']) {
    const env = environment();
    const blob = await networkToRaster('<svg/>', {
      ...env,
      type,
      background: '#abc',
      scale: 2,
    });
    assert.equal(blob.type, type);
    assert.deepEqual(env.calls.at(-1), ['revoke', 'blob:test']);
    const fill = env.calls.find((call) => call[0] === 'fill');
    assert.deepEqual(
      fill,
      type === 'image/jpeg' ? ['fill', '#abc', 0, 0, 200, 120] : undefined
    );
  }
});
it('rejects oversized raster dimensions before allocating a canvas and releases its URL', async () => {
  const env = environment(10000, 10000);
  await assert.rejects(networkToRaster('<svg/>', env), /pixel limit/u);
  assert.deepEqual(env.calls, [['revoke', 'blob:test']]);
  await assert.rejects(
    networkToRaster('<svg/>', { ...env, type: 'image/gif' }),
    /format/u
  );
  await assert.rejects(
    networkToRaster('<svg/>', { ...env, scale: Infinity }),
    /scale/u
  );
  await assert.rejects(
    networkToRaster('<svg/>', { ...env, quality: -1 }),
    /quality/u
  );
});

it('preserves legacy PNG dimensions above the new raster API default limit', async () => {
  const env = environment(5000, 4000);
  const blob = await networkToPng('<svg/>', 1, env);
  assert.equal(blob.type, 'image/png');
  assert.equal(
    env.calls.some((call) => call[0] === 'canvas'),
    true
  );
});
