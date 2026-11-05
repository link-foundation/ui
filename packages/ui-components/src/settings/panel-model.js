import { fieldVisible } from './conditions.js';
import {
  activePreset,
  countCustomized,
  merge,
} from '@link-foundation/ui-settings';

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
    const text = [
      field.key,
      field.label,
      field.description,
      sections.get(id).label,
    ]
      .join(' ')
      .toLocaleLowerCase();
    if (
      text.includes(needle) &&
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
