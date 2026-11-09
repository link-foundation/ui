import { seededRandom } from '../random.js';
import { mountLayer, changed, radians } from './common.js';

const vertex =
  'attribute vec2 position; void main() { gl_Position = vec4(position, 0.0, 1.0); }';
const defaults = {
  source: '',
  uniforms: {},
  times: { time: 1 },
  startTime: 0,
  seed: 224,
};
function compile(gl, type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    throw new Error('Background shader compilation failed');
  }
  return shader;
}
function programFor(gl, source) {
  const shaders = [];
  let program;
  try {
    shaders.push(compile(gl, gl.VERTEX_SHADER, vertex));
    shaders.push(compile(gl, gl.FRAGMENT_SHADER, source));
    program = gl.createProgram();
    shaders.forEach((shader) => gl.attachShader(program, shader));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      throw new Error('Background shader link failed');
    }
    return program;
  } catch (error) {
    if (program) {
      gl.deleteProgram(program);
    }
    throw error;
  } finally {
    shaders.forEach((shader) => gl.deleteShader(shader));
  }
}
function upload(gl, location, value) {
  if (typeof value === 'number') {
    gl.uniform1f(location, value);
  } else if (
    typeof value === 'string' &&
    value.startsWith('#') &&
    value.length === 7
  ) {
    gl.uniform3f(
      location,
      ...[1, 3, 5].map((i) => parseInt(value.slice(i, i + 2), 16) / 255)
    );
  } else if (value && typeof value.degrees === 'number') {
    gl.uniform1f(location, radians(value.degrees));
  }
}
function create(canvas, win, initial) {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true,
  });
  if (!gl) {
    return null;
  }
  let program = programFor(gl, initial.source ?? '');
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW
  );
  let o,
    area,
    failed = false;
  const clocks = new Map();
  function configure() {
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
  }
  configure();
  return {
    defaults,
    webgl: true,
    update(next, before) {
      o = next;
      if (before.source !== undefined && before.source !== next.source) {
        try {
          const replacement = programFor(gl, next.source);
          gl.deleteProgram(program);
          program = replacement;
          configure();
          failed = false;
          canvas.style.visibility = '';
        } catch (error) {
          failed = true;
          canvas.style.visibility = 'hidden';
          o.onError?.(error);
        }
      }
      for (const name of Object.keys(next.times)) {
        if (!clocks.has(name) || next.startTime !== before.startTime) {
          clocks.set(
            name,
            next.startTime === 'random'
              ? seededRandom(`${next.seed}:${name}`)() * 1000
              : Number(next.startTime)
          );
        }
      }
      return changed(next, before, ['source', 'uniforms', 'startTime']);
    },
    resize(next) {
      area = next;
      gl.viewport(0, 0, canvas.width, canvas.height);
    },
    draw(dt, { still }) {
      if (failed) {
        return;
      }
      gl.useProgram(program);
      const location = (name) => gl.getUniformLocation(program, name);
      gl.uniform2f(location('resolution'), canvas.width, canvas.height);
      gl.uniform1f(location('pixelRatio'), area.ratio);
      for (const [name, speed] of Object.entries(o.times)) {
        const time = clocks.get(name) + (still ? 0 : dt * speed);
        clocks.set(name, time);
        gl.uniform1f(location(name), time);
      }
      for (const [name, value] of Object.entries(o.uniforms)) {
        upload(gl, location(name), value);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    },
    dispose() {
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    },
  };
}
export const mount = (canvas, options = {}) =>
  mountLayer(canvas, options, create);
