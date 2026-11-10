/** The basic control used by each schema kind. Custom vector/list types are
 * registered with ui-settings by the application, using defineFieldType. */
const CONTROLS = Object.freeze({
  toggle: 'switch',
  choice: 'select',
  range: 'slider',
  number: 'number-field',
  color: 'color-field',
  text: 'text-field',
  vector: 'vector',
  vector3: 'vector',
  list: 'chips',
});

/** @param {import('@link-foundation/ui-settings').SettingField} field */
export function controlFor(field) {
  const element = CONTROLS[field.type];
  if (!element) {
    throw new TypeError(`Unsupported settings control: ${field.type}`);
  }
  const props = { label: field.label ?? field.key };
  if (element === 'number-field' && field.normalization?.numbers) {
    props.normalization = field.normalization.numbers;
  }
  for (const key of ['min', 'max', 'step', 'unit', 'options']) {
    if (field[key] !== undefined) {
      props[key] = field[key];
    }
  }
  for (const key of [
    'fallback',
    'inherit',
    'mode',
    'palettes',
    'snapping',
    'rgb',
    'palette',
    'menu-min-width',
    'menu-max-height',
  ]) {
    if (field.props?.[key] !== undefined) {
      props[key] = field.props?.[key];
    }
  }
  if (Array.isArray(props.palettes)) {
    props.palettes = props.palettes.map((group) =>
      group?.name
        ? [
            ['name', group.name],
            [
              'colors',
              ...group.colors.map((color) => [
                ['name', color.name],
                ['hex', color.hex],
              ]),
            ],
          ]
        : group
    );
  }
  return { element, props };
}
