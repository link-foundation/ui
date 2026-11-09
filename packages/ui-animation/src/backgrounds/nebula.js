/** Original analytic gas field; no consumer shader source or artwork. */
export const source = `
precision mediump float;
uniform vec2 resolution;
uniform float time, twinkleTime, gas, hue, starDensity, starBrightness;
uniform float twinkle, vignette, zoom, starSize;
uniform vec3 gasColor1, gasColor2, gasColor3, gasColor4, starColor;
float hash(vec2 p) { return fract(sin(dot(p, vec2(17.13, 91.71))) * 4317.173); }
vec3 hueTurn(vec3 c, float a) {
  vec3 axis = normalize(vec3(1.0));
  return c*cos(a) + cross(axis,c)*sin(a) + axis*dot(axis,c)*(1.0-cos(a));
}
void main() {
  vec2 uv = (gl_FragCoord.xy - resolution*.5) / resolution.y;
  vec2 p = uv / zoom;
  float t = time * .025;
  float a = .5 + .5*sin(p.x*3.7 + sin(p.y*4.3+t) + t);
  float b = .5 + .5*cos(p.y*4.9 + sin(p.x*3.1-t) - t*.7);
  vec3 cloud = mix(mix(gasColor1,gasColor2,a),mix(gasColor3,gasColor4,b),a*b);
  float veil = pow(a*b, 1.4) * gas;
  vec2 cells = p * 130.0;
  vec2 id = floor(cells);
  float exists = step(1.0 - starDensity*.045, hash(id));
  float radius = length(fract(cells)-vec2(hash(id+1.0),hash(id+2.0)));
  float point = 1.0-smoothstep(.005, .045*starSize, radius);
  float flicker = 1.0 - .35*twinkle*(.5+.5*sin(twinkleTime+hash(id)*6.28));
  vec3 color = hueTurn(cloud*veil,hue) + starColor*point*exists*starBrightness*max(.0,flicker);
  color *= 1.0-vignette*smoothstep(.1,1.0,length(uv));
  gl_FragColor = vec4(max(vec3(.008,.012,.025),color),1.0);
}`;

export const uniforms = {
  gas: 1.2,
  hue: { degrees: 0 },
  starDensity: 1,
  starBrightness: 1,
  twinkle: 1,
  vignette: 0.5,
  zoom: 1,
  starSize: 1,
  gasColor1: '#17274a',
  gasColor2: '#384477',
  gasColor3: '#57366a',
  gasColor4: '#194953',
  starColor: '#dcecff',
};

/** Pass these options to the independent shader entry point's mount(). */
export function nebula(options = {}) {
  const { driftSpeed = 1, twinkleSpeed = 1, ...rest } = options;
  return {
    ...rest,
    source,
    uniforms: { ...uniforms, ...rest.uniforms },
    times: { time: driftSpeed, twinkleTime: twinkleSpeed, ...rest.times },
  };
}
