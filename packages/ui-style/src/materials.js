/** Opaque by default, including browsers without either feature. */
export function materialCss(name, selector, conditions, options = {}) {
  if (options.transparency === 'off' || options.reducedTransparency) {
    return '';
  }
  const variable = (path) =>
    `var(--${options.prefix ? `${options.prefix}-` : ''}${path.replaceAll('.', '-')})`;
  const filter = `blur(${variable(`material.${name}.blur`)})`;
  const opacity = `calc(${variable(`material.${name}.opacity`)} * 100%)`;
  // Effective comfort attributes come from ui-dom's configuration cascade.
  const allowed = `:is(${selector}):not([data-transparency="off"], [data-transparency="off"] *)`;
  let css = `@media (prefers-reduced-transparency: no-preference) and (forced-colors: none) {\n@supports (backdrop-filter: blur(1px)) {\n${allowed} {\n  background-color: color-mix(in srgb, ${variable('color.surface')} ${opacity}, transparent);\n  backdrop-filter: ${filter};\n}\n}\n}\n`;
  for (const { kind, conditions: at } of [...conditions].reverse()) {
    // Conditions were validated and typed by the standard style reader.
    const query = at
      .map(
        ({ feature, value }) =>
          `(${feature}: ${value.value}${value.unit ?? ''})`
      )
      .join(' and ');
    css = `@${kind} ${query} {\n${css}}\n`;
  }
  return css;
}
