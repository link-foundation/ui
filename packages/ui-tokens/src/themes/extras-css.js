import { cssVariable } from '../names.js';

/** Bounded analytical spring samples; response maps to #52's k=(2π/r)², c=2ζ√k, m=1. */
export function springLinear({ response, damping }) {
  const omega = (2 * Math.PI) / response;
  const decay = damping * omega;
  const frequency = omega * Math.sqrt(1 - damping * damping);
  const duration =
    Math.log(1 / (0.0005 * Math.sqrt(1 - damping * damping))) / decay;
  return `linear(${Array.from({ length: 41 }, (_, index) => {
    if (index === 0) {
      return '0';
    }
    if (index === 40) {
      return '1';
    }
    const time = (duration * index) / 40;
    return String(
      Number(
        (
          1 -
          Math.exp(-decay * time) *
            (Math.cos(frequency * time) +
              (decay / frequency) * Math.sin(frequency * time))
        ).toFixed(5)
      )
    );
  }).join(', ')})`;
}

/** Optional type scale and spring metadata augment the ordinary theme rules. */
export function themeExtrasCss(theme, root, options) {
  const variable = (path) => `var(${cssVariable(path, options.prefix)})`;
  const css = [];
  const springs = Object.entries(theme.springs ?? {});
  if (springs.length) {
    css.push(
      `${root} {\n${springs.map(([name, spring]) => `  ${cssVariable(`motion.spring.${name}`, options.prefix)}: ${springLinear(spring)};`).join('\n')}\n}`
    );
  }
  if (!theme.tokens.has('text.base.size')) {
    return css.join('\n');
  }
  css.push(
    `${root} { font-family: ${variable('font.family.text')}; font-size: ${variable('text.base.size')}; color: ${variable('color.on-surface')}; background-color: ${variable('color.surface')}; --ui-control-height: max(${variable('size.target.min')}, ${variable('size.control.height')}); --ui-control-corner: ${variable('shape.corner.small')}; --ui-control-border: 1px solid ${variable('color.separator')}; --ui-control-transition: ${variable('motion.duration.short')} ${variable('motion.spring.default')}; }`
  );
  const inner = [
    `:scope ui-button [data-part="root"], :scope ui-switch [data-part="input"], :scope ui-text-field [data-part="input"], :scope ui-slider [data-part="thumb"], :scope ui-number-field [data-part="input"], :scope ui-radio [data-part="input"], :scope ui-select [data-part="input"] { min-height: max(${variable('size.target.min')}, ${variable('size.control.height')}); }`,
  ];
  for (const path of theme.tokens.keys()) {
    if (
      !path.startsWith('text.') ||
      !path.endsWith('.size') ||
      path === 'text.base.size'
    ) {
      continue;
    }
    const name = path.slice(5, -5);
    if (!/^[a-z0-9-]+$/u.test(name)) {
      continue;
    }
    inner.push(
      `ui-text[text-style="${name}"] { font-size: calc(${variable(path)} / 1rem * ${variable('text.base.size')}); font-weight: ${variable(`text.${name}.weight`)}; }`
    );
  }
  inner.push(`ui-radio-group[appearance="segmented"] { display: flex; flex-direction: row; padding: ${variable('space.x-small')}; border-radius: ${variable('shape.corner.medium')}; background: ${variable('color.grouped-background')}; }
ui-radio-group[appearance="segmented"] ui-radio [data-part="input"] { border-radius: ${variable('shape.corner.small')}; padding: ${variable('space.small')}; }
ui-radio-group[appearance="segmented"] ui-radio [aria-checked="true"] { background: ${variable('color.primary')}; color: ${variable('color.on-primary')}; }
ui-radio-group[appearance="segmented"] [data-part="indicator"] { display: none; }
ui-switch [data-part="thumb"] { transition: transform ${variable('motion.duration.medium')} ${variable('motion.spring.default')}, opacity ${variable('motion.duration.fade')} linear; }
ui-switch [aria-checked="true"] [data-part="thumb"] { transform: translateX(${variable('motion.switch.travel')}); }
ui-switch [data-part="track"] { position: relative; }
ui-slider { --ui-control-thumb-size: max(${variable('size.target.min')}, ${variable('size.control.height')}); }
ui-list > * { min-height: ${variable('size.list-row.height')}; }`);
  const reduced = `ui-switch [data-part="thumb"], ui-switch [aria-checked="true"] [data-part="thumb"] { opacity: 0; transform: none; }
ui-switch [data-part="track"]::before, ui-switch [data-part="track"]::after { content: ""; position: absolute; top: 2px; width: 1.25rem; height: 1.25rem; border-radius: 50%; background: ${variable('color.on-primary')}; transition: opacity ${variable('motion.duration.fade')} linear; }
ui-switch [data-part="track"]::before { left: 2px; opacity: 1; }
ui-switch [data-part="track"]::after { right: 2px; opacity: 0; }
ui-switch [aria-checked="true"] [data-part="track"]::before { opacity: 0; }
ui-switch [aria-checked="true"] [data-part="track"]::after { opacity: 1; }`;
  css.push(
    `@scope (${root}) to (:scope [data-theme]) {\n${inner.join('\n')}\n}`
  );
  css.push(
    `@scope (${root}[data-motion="reduced"]) to (:scope [data-theme]) {\n${reduced}\n}`
  );
  css.push(
    `@media (prefers-reduced-motion: reduce) { @scope (${root}[data-motion="system"]) to (:scope [data-theme]) {\n${reduced}\n} }`
  );
  return css.join('\n');
}
