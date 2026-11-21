import { fieldVisible } from './conditions.js';
import {
  activePreset,
  countCustomized,
  merge,
} from '@link-foundation/ui-settings';

function matchesQuery(field, section, needle) {
  return [field.key, field.label, field.description, section.label]
    .join(' ')
    .toLocaleLowerCase()
    .includes(needle);
}

export function availableTabs(section, values, options) {
  const needle = options.query?.trim().toLocaleLowerCase() ?? '';
  return (section.tabs ?? []).filter((tab) =>
    section.fields.some(
      (field) =>
        field.props.tab === tab &&
        fieldVisible(
          field,
          values,
          { ...options, tabs: { [section.id]: tab } },
          section
        ) &&
        matchesQuery(field, section, needle)
    )
  );
}

/** Pure section/search model. Equality and validation belong to ui-settings.
 * @param {import('@link-foundation/ui-settings').SettingsSchema} schema
 * @param {Record<string, unknown>} values
 * @param {{ query?: string }} [options]
 */
export function buildPanelModel(schema, values, options = {}) {
  const { query = '', includeAll = false } = options;
  const all = merge(schema, values, undefined).values;
  const needle = query.trim().toLocaleLowerCase();
  const sections = new Map(
    schema.sections.map((s) => [s.id, { ...s, fields: [] }])
  );
  for (const field of schema.fields.values()) {
    const id = field.section ?? '';
    if (!sections.has(id)) {
      sections.set(id, { id, label: id || 'General', fields: [] });
    }
    if (
      matchesQuery(field, sections.get(id), needle) &&
      (includeAll || fieldVisible(field, all, options, sections.get(id)))
    ) {
      sections.get(id).fields.push(field);
    }
  }
  return {
    sections: [...sections.values()].filter((s) => s.fields.length),
    visibleCount: [...sections.values()].reduce(
      (n, s) => n + s.fields.length,
      0
    ),
    changedCount: countCustomized(schema, all),
    activePreset: activePreset(schema, all) ?? undefined,
  };
}
