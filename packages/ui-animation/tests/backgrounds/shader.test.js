import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mount } from '../../src/backgrounds/shader.js';
import { nebula } from '../../src/backgrounds/nebula.js';
import { environment } from './helpers.js';

function webgl({ compile = true, link = true } = {}) {
  const e = environment();
  const calls = [];
  const gl = new Proxy(
    {
      getShaderParameter: () => compile,
      getProgramParameter: () => link,
      createShader: () => ({}),
      createProgram: () => ({}),
      createBuffer: () => ({}),
      getUniformLocation: (_program, name) => name,
      getAttribLocation: () => 0,
    },
    {
      get: (target, name) =>
        name in target
          ? target[name]
          : (...args) => calls.push([name, ...args]),
    }
  );
  e.canvas.getContext = (type, options) => {
    calls.push(['getContext', type, options]);
    return gl;
  };
  return { ...e, calls, gl };
}

test('shader sizes with resolution share, uploads typed uniforms and independent clocks', () => {
  const e = webgl();
  const layer = mount(
    e.canvas,
    nebula({
      resolution: 0.5,
      uniforms: { hue: { degrees: 180 } },
      times: { time: 2, twinkleTime: 3 },
    })
  );
  assert.equal(e.canvas.width, 300);
  e.resize(800, 600);
  assert.equal(e.canvas.width, 800);
  const size = e.calls.length;
  e.resize(800, 600);
  layer.update({ fps: 30 });
  assert.equal(e.calls.length, size);
  assert.ok(
    e.calls.some(
      (c) => c[0] === 'uniform1f' && c[1] === 'hue' && c[2] === Math.PI
    )
  );
  assert.deepEqual(e.calls.find((c) => c[0] === 'getContext')[2], {
    alpha: false,
    antialias: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  e.tick(0);
  e.tick(100);
  layer.animate(false);
  const last = (name) =>
    e.calls.filter((c) => c[0] === 'uniform1f' && c[1] === name).at(-1)[2];
  assert.equal(last('time'), 0.2);
  assert.ok(Math.abs(last('twinkleTime') - 0.3) < 1e-8);
  layer.update({ times: { time: 8, twinkleTime: 0 } });
  layer.animate(true);
  e.tick(10000);
  assert.equal(last('time'), 0.2);
  e.tick(10100);
  assert.equal(last('time'), 1);
  assert.ok(Math.abs(last('twinkleTime') - 0.3) < 1e-8);
  layer.dispose();
});

for (const failure of [{ compile: false }, { link: false }]) {
  test(`shader failure ${JSON.stringify(failure)} cleans resources and returns noop`, () => {
    const e = webgl(failure);
    const layer = mount(e.canvas, nebula());
    layer.update({ uniforms: {} });
    layer.animate(true);
    layer.dispose();
    assert.equal(e.frames.size, 0);
    assert.equal(e.canvas.style.visibility, 'hidden');
    assert.ok(e.calls.some(([name]) => name === 'deleteShader'));
    if (failure.link === false) {
      assert.ok(e.calls.some(([name]) => name === 'deleteProgram'));
    }
  });
}

test('missing WebGL is harmless', () => {
  const e = environment();
  e.canvas.getContext = () => null;
  mount(e.canvas, nebula()).dispose();
  assert.equal(e.frames.size, 0);
});

test('live shader compilation failures reveal fallback and a valid update recovers', () => {
  const e = webgl();
  const errors = [];
  const layer = mount(
    e.canvas,
    nebula({ onError: (error) => errors.push(error) })
  );
  e.gl.getShaderParameter = () => false;
  layer.update({ source: 'invalid GLSL' });
  assert.equal(e.canvas.style.visibility, 'hidden');
  assert.equal(errors.length, 1);
  const draws = e.calls.filter(([name]) => name === 'drawArrays').length;
  e.tick(0);
  e.tick(100);
  assert.equal(e.calls.filter(([name]) => name === 'drawArrays').length, draws);
  e.gl.getShaderParameter = () => true;
  layer.update(nebula());
  assert.equal(e.canvas.style.visibility, '');
  assert.ok(e.calls.filter(([name]) => name === 'drawArrays').length > draws);
  layer.dispose();
  assert.equal(e.frames.size, 0);
});

test('slow windows lower WebGL resolution and then fps, without later recovery', () => {
  const e = webgl();
  const layer = mount(e.canvas, nebula());
  e.tick(0);
  for (let i = 1; i <= 240; i++) {
    e.tick(i * 60);
  }
  assert.equal(e.canvas.width, 240);
  const draws = e.calls.filter(([name]) => name === 'drawArrays').length;
  for (let i = 1; i <= 60; i++) {
    e.tick(14400 + (i * 1000) / 60);
  }
  assert.equal(e.canvas.width, 240);
  assert.ok(
    e.calls.filter(([name]) => name === 'drawArrays').length - draws <= 16
  );
  layer.dispose();
});

test('adaptive false keeps resolution and full cadence through slow windows', () => {
  const e = webgl();
  const layer = mount(e.canvas, nebula({ adaptive: false }));
  e.tick(0);
  for (let i = 1; i <= 240; i++) {
    e.tick(i * 60);
  }
  assert.equal(e.canvas.width, 600);
  const draws = e.calls.filter(([name]) => name === 'drawArrays').length;
  for (let i = 1; i <= 60; i++) {
    e.tick(14400 + (i * 1000) / 60);
  }
  assert.equal(
    e.calls.filter(([name]) => name === 'drawArrays').length - draws,
    60
  );
  layer.dispose();
});
