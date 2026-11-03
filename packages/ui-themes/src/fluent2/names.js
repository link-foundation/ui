/** Semantic equivalents from docs/guidelines/token-taxonomy.md. Other aliases
 * retain a Fluent namespace, including their state suffixes. */
const semantic = {
  colorNeutralBackground1: 'color.surface',
  colorNeutralForeground1: 'color.on-surface',
  colorNeutralForeground2: 'color.on-surface-variant',
  colorBrandBackground: 'color.primary',
  colorNeutralForegroundOnBrand: 'color.on-primary',
  colorNeutralStrokeAccessible: 'color.outline',
  borderRadiusMedium: 'shape.corner.small',
  spacingHorizontalS: 'space.small',
  spacingHorizontalL: 'space.medium',
  fontSizeBase300: 'type.body.medium.size',
  lineHeightBase300: 'type.body.medium.line-height',
  durationFast: 'motion.duration.short',
  curveEasyEase: 'motion.easing.standard',
};
export const fluentTokenPath = (name) =>
  semantic[name] ??
  `fluent.${name.replace(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}`;

export const FLUENT_FILES = [
  ...['light', 'dark', 'high-contrast'].flatMap((mode) =>
    ['colors', 'shape', 'spacing', 'type', 'shadow', 'motion'].map(
      (group) => group + (mode === 'light' ? '' : `-${mode}`)
    )
  ),
  'styles',
  'templates',
  'theme',
];
