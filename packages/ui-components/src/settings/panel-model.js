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

export function selectedTab(section, tabs, available) {
  const wanted = tabs?.[section.id] ?? section.tabs?.[0];
  return available.includes(wanted) ? wanted : available[0];
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
    sections.get(id).fields.push(field);
  }
  const visible = [...sections.values()].filter((section) => {
    const available = includeAll ? [] : availableTabs(section, all, options);
    const tab = selectedTab(section, options.tabs, available);
    const scope = { ...options, tabs: { [section.id]: tab } };
    section.fields = section.fields.filter(
      (field) =>
        matchesQuery(field, section, needle) &&
        (includeAll || fieldVisible(field, all, scope, section))
    );
    return section.fields.length;
  });
  return {
    sections: visible,
    visibleCount: visible.reduce((n, s) => n + s.fields.length, 0),
    changedCount: countCustomized(schema, all),
    activePreset: activePreset(schema, all) ?? undefined,
  };
}
