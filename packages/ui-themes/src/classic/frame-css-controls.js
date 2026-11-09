import { enumRules } from './frame-css-enums.js';

export function createCssContext(frames, options) {
  const ctx = {
    frames,
    ...options,
    registrations: new Map(),
    controls: new Map(),
    unresolvedColors: new Set(),
    enumCss: '',
    enumerations: [],
    prop(level, key) {
      return `--${ctx.prefix}-${level}-${key}`;
    },
    variable(level, key) {
      return `var(${ctx.prop(level, key)})`;
    },
    register(name, syntax = '<length>', initial = '0px', inherits = true) {
      ctx.registrations.set(name, { syntax, initial, inherits });
    },
    set(
      level,
      key,
      value,
      syntax = '<length>',
      initial = '0px',
      inherits = true
    ) {
      const property = ctx.prop(level, key);
      ctx.register(property, syntax, initial, inherits);
      ctx.controls.set(property, { level, property, syntax, inherits });
      return [property, String(value)];
    },
    color(level, key, value) {
      const result = ctx.set(level, key, value, '<color>', 'black');
      // currentColor depends on the drawing element. Keep its input unresolved;
      // the non-inheriting geometry alias provides the typed final color.
      const name = ctx.prop(level, key);
      if (value.includes('currentColor')) {
        ctx.unresolvedColors.add(name);
      }
      if (ctx.unresolvedColors.has(name)) {
        ctx.registrations.delete(name);
      }
      return result;
    },
    enumeration(level, key, choices, declarations) {
      const attribute = `data-${ctx.prefix}-${level}-${key}`;
      ctx.controls.set(attribute, { level, attribute, choices });
      ctx.enumerations.push({ level, key, choices, declarations });
    },
    renderEnums() {
      ctx.enumCss += enumRules(ctx);
    },
    properties() {
      return [...ctx.registrations]
        .map(
          ([name, { syntax, initial, inherits }]) =>
            `@property ${name} {\n  syntax: "${syntax}";\n  inherits: ${inherits};\n  initial-value: ${initial};\n}\n`
        )
        .join('');
    },
  };
  return ctx;
}
