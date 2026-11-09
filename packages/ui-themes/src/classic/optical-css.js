import { materialNoise } from './optics.js';

/** Static surface layer. Put content/frame in siblings, and clip their common host. */
export function opticalMaterialCss(selector = '[data-material]') {
  const v = (key, fallback = 0) => `var(--material-${key}, ${fallback})`;
  const alpha = v('opacity', 1);
  const light = (key, factor = 1) =>
    `rgb(255 255 255 / calc(${v(key)} * ${alpha} * ${factor}))`;
  const tint = `color-mix(in srgb, ${v('tint', 'var(--color-surface)')} calc(${v('tint-level')} * ${alpha} * 100%), transparent)`;
  const filter = `${v('refraction-filter', '')} blur(${v('blur', '0px')}) saturate(${v('saturation', '100%')}) brightness(${v('brightness', '100%')}) contrast(${v('contrast', '100%')})`;
  return `${selector} {
  --material-noise-image: ${materialNoise(1, 1)};
  isolation: isolate;
  background-color: var(--material-color, var(--color-surface));
  border: ${v('border-width', '0px')} solid ${light('border-light')};
}
@media (prefers-reduced-transparency: no-preference) and (forced-colors: none) {
  ${selector}:not([data-transparency="off"], [data-transparency="off"] *) {
    background-color: color-mix(in srgb, var(--material-color, var(--color-surface)) calc(${alpha} * 100%), transparent);
    backdrop-filter: ${filter};
  }
}
${selector}::before, ${selector}::after {
  content: ""; position: absolute; inset: 0; pointer-events: none; border-radius: inherit;
}
${selector}::before {
  z-index: 1;
  background-image: ${v('noise-image', 'none')};
  opacity: calc(${v('noise')} * ${alpha});
}
${selector}[data-material-noise]::before { background-image: var(--material-noise-image); }
${selector}::after {
  z-index: 0;
  background-image: linear-gradient(${v('sheen-angle', '0deg')}, transparent, ${light('sheen')}, transparent), linear-gradient(${v('light-angle', '0deg')}, ${light('sheen', 0.35)}, transparent), linear-gradient(${tint}, ${tint});
  box-shadow: inset 0 1px ${light('highlight')}, inset 1px 0 ${light('highlight', 0.35)}, inset -1px 0 ${light('highlight', 0.35)}, inset 0 -1px ${light('highlight', 0.25)}, inset 0 0 ${v('depth-blur', '0px')} ${light('depth')};
}
${selector} { box-shadow: 0 ${v('shadow-distance', '0px')} ${v('shadow-blur', '0px')} ${v('shadow-spread', '0px')} rgb(0 0 0 / calc(${v('shadow')} * ${alpha})); }
${selector}[data-material-opacity="0"] { background: transparent; backdrop-filter: none !important; box-shadow: none; }
${selector}[data-material-opacity="0"]::before, ${selector}[data-material-opacity="0"]::after { content: none; }
@keyframes ui-material-sheen { from { background-position: -200% 0; } to { background-position: 200% 0; } }
@media (prefers-reduced-motion: no-preference) {
  ${selector}[data-material-motion]:not([data-motion="off"], [data-motion="off"] *)::after { animation: ui-material-sheen 6s linear infinite; background-size: 200% 100%; }
  ${selector}[data-material-motion]:hover:not([data-motion="off"], [data-motion="off"] *)::after { animation-duration: 1s; }
}
${selector}[data-material-motion]:is([data-motion="on"], [data-motion="on"] *):not([data-motion="off"], [data-motion="off"] *)::after { animation: ui-material-sheen 6s linear infinite; background-size: 200% 100%; }
`;
}
