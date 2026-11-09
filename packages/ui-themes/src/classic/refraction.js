const NS = 'http://www.w3.org/2000/svg';
const providerKey = '__linkUiMaterialRefraction';
const ranges = Object.freeze({
  scale: [0, 150, 40],
  detail: [2, 60, 12],
  octaves: [1, 4, 2],
  smoothing: [0, 10, 2],
  seed: [0, 100, 13],
});

function parameters(options) {
  return Object.fromEntries(
    Object.entries(ranges).map(([key, [min, max, fallback]]) => {
      const value = options[key] ?? fallback;
      if (
        !Number.isFinite(value) ||
        value < min ||
        value > max ||
        (['octaves', 'seed'].includes(key) && !Number.isInteger(value))
      ) {
        throw new RangeError(`Invalid refraction ${key}`);
      }
      return [key, value];
    })
  );
}

function transparencyOff(preferences, media) {
  return (
    [false, 'off'].includes(preferences.transparency) ||
    preferences.reducedTransparency ||
    ((preferences.transparency ?? 'auto') === 'auto' && media?.matches)
  );
}

/** Chromium is deliberately allowlisted: CSS.supports accepts unusable SVG URLs in other engines. */
export function createRefractionProvider(
  document = globalThis.document,
  options = {}
) {
  const params = parameters(options);
  if (document[providerKey]) {
    return document[providerKey];
  }
  const view = document.defaultView;
  const ua = view?.navigator.userAgent ?? '';
  const supported =
    /(?:Chrome|Chromium)\//u.test(ua) &&
    !/Firefox\//u.test(ua) &&
    Boolean(view?.CSS?.supports('backdrop-filter', 'blur(1px)'));
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('width', '0');
  svg.setAttribute('height', '0');
  svg.style.cssText = 'position:absolute;pointer-events:none;overflow:hidden';
  const make = (name, attrs, parent = svg) => {
    const node = document.createElementNS(NS, name);
    for (const [key, value] of Object.entries(attrs)) {
      node.setAttribute(key, String(value));
    }
    parent.append(node);
    return node;
  };
  // IDs cannot collide with a host's existing artwork.
  let id = 'ui-material-refraction';
  while (document.getElementById(id)) {
    id += '-filter';
  }
  const filter = make('filter', {
    id,
    x: '-50%',
    y: '-50%',
    width: '200%',
    height: '200%',
    'color-interpolation-filters': 'sRGB',
  });
  make(
    'feTurbulence',
    {
      type: 'fractalNoise',
      baseFrequency: params.detail / 1000,
      numOctaves: params.octaves,
      seed: params.seed,
      result: 'noise',
    },
    filter
  );
  make(
    'feGaussianBlur',
    { in: 'noise', stdDeviation: params.smoothing, result: 'smooth' },
    filter
  );
  make(
    'feDisplacementMap',
    {
      in: 'SourceGraphic',
      in2: 'smooth',
      scale: 0,
      xChannelSelector: 'R',
      yChannelSelector: 'G',
    },
    filter
  );
  (document.body ?? document.documentElement).append(svg);
  const media = view?.matchMedia?.('(prefers-reduced-transparency: reduce)');
  const references = new Map();
  let disposed = false;
  const provider = {
    supported,
    reference(strength, preferences = {}) {
      if (!Number.isFinite(strength) || strength < 0 || strength > 1) {
        throw new RangeError('Invalid refraction strength');
      }
      if (
        disposed ||
        !supported ||
        transparencyOff(preferences, media) ||
        !strength
      ) {
        return '';
      }
      if (!references.has(strength)) {
        const node = references.size ? filter.cloneNode(true) : filter;
        const filterId = references.size ? `${id}-${references.size}` : id;
        node.setAttribute('id', filterId);
        node
          .querySelector('feDisplacementMap')
          .setAttribute('scale', String(params.scale * strength));
        if (node !== filter) {
          svg.append(node);
        }
        references.set(strength, `url("#${filterId}")`);
      }
      return references.get(strength);
    },
    dispose() {
      disposed = true;
      references.clear();
      svg.remove();
      delete document[providerKey];
    },
  };
  document[providerKey] = provider;
  return provider;
}
