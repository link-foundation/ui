import { defaults } from '@link-foundation/ui-settings';
import { fieldVisible } from './conditions.js';

/** Stable estimates use defaults and the first tab/level, never the edited value. */
export function estimateSection(section, schema) {
  const values = defaults(schema);
  const fields = section.fields.filter((field) =>
    fieldVisible(field, values, {}, section)
  );
  if (!fields.length) {
    return 0;
  }
  return (
    64 +
    (section.description ? 48 : 0) +
    (section.tabs?.length ? 44 : 0) +
    (section.levels?.length ? 44 : 0) +
    fields.reduce(
      (height, field) => height + 88 + (field.description ? 40 : 0),
      0
    ) +
    (section.extraHeight ?? 0)
  );
}

function references(raw, schema) {
  return (Array.isArray(raw) ? raw.flat(Infinity) : [raw])
    .map((key) => schema.fields.get(key)?.section)
    .filter(Boolean);
}

/** Assign once: editing, searching and switching levels cannot reparent a section. */
export function sectionColumns(context, body, sections) {
  const { options, node, schema } = context;
  const count = Math.max(
    1,
    Math.min(
      12,
      Math.floor(options.columns?.count ?? options.columns ?? 1) || 1
    )
  );
  body.style.setProperty('--settings-columns', String(count));
  if (options.columns?.balance !== 'estimate') {
    return () => body;
  }
  const columns = Array.from({ length: count }, () => {
    const column = node('div', undefined, body);
    column.className = 'settings-column';
    return { column, height: 0 };
  });
  const placements = new Map();
  const anchors = new Map();
  const waiting = new Map();
  const ids = new Set(sections.map((section) => section.id));
  const place = (section, group) => {
    const dependencies = [
      ...references(section['visible-when'], schema),
      ...section.fields.flatMap((f) =>
        references(f.props['visible-when'], schema)
      ),
    ];
    const dependency = dependencies.find(
      (id) => id !== section.id && ids.has(id)
    );
    if (dependency && !placements.has(dependency)) {
      const pending = waiting.get(dependency) ?? [];
      pending.push({ section, group });
      waiting.set(dependency, pending);
      return body;
    }
    const target = dependency
      ? placements.get(dependency)
      : columns.reduce((a, b) => (a.height <= b.height ? a : b));
    placements.set(section.id, target);
    target.height += estimateSection(section, schema);
    const anchor = anchors.get(dependency);
    if (anchor) {
      anchor.after(group);
      anchors.set(dependency, group);
    } else {
      target.column.append(group);
    }
    anchors.set(section.id, group);
    for (const pending of waiting.get(section.id) ?? []) {
      place(pending.section, pending.group);
    }
    waiting.delete(section.id);
    return target.column;
  };
  return place;
}
