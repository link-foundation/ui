import { merge } from '@link-foundation/ui-settings';
import { fieldVisible } from './conditions.js';
import { buildPanelModel, availableTabs, selectedTab } from './panel-model.js';

/** Estimate the fields visible with the initial values and selection. */
export function estimateSection(section, schema, values, options = {}) {
  const all = merge(schema, values, undefined).values;
  return measure(section, all, options);
}

function measure(section, values, options) {
  const tabs = availableTabs(section, values, options);
  const scope = {
    ...options,
    tabs: { [section.id]: selectedTab(section, options.tabs, tabs) },
  };
  const fields = section.fields.filter((field) =>
    fieldVisible(field, values, scope, section)
  );
  return fields.length === 0
    ? 0
    : 64 +
        (section.description ? 48 : 0) +
        (tabs.length ? 44 : 0) +
        (section.levels?.length ? 44 : 0) +
        fields.reduce(
          (height, field) => height + 88 + (field.description ? 40 : 0),
          0
        ) +
        (section.extraHeight ?? 0);
}

function conditionFields(condition) {
  if (condition === undefined) {
    return [];
  }
  if (!Array.isArray(condition)) {
    return [condition];
  }
  const [head, ...args] = condition;
  if (Array.isArray(head)) {
    return condition.flatMap(conditionFields);
  }
  if (head === 'not') {
    return conditionFields(args.length === 1 ? args[0] : args);
  }
  return head === 'all' || head === 'any'
    ? args.flatMap(conditionFields)
    : [head];
}

export function revealingFields(section) {
  return [
    section['visible-when'],
    ...section.fields.map((field) => field.props['visible-when']),
  ].flatMap(conditionFields);
}

function revealingSection(section, schema, ids) {
  return revealingFields(section)
    .map((key) => schema.fields.get(key))
    .filter(Boolean)
    .map((field) => field.section ?? '')
    .find((id) => id !== section.id && ids.has(id));
}

export function columnCount(columns) {
  return Math.max(
    1,
    Math.min(12, Math.floor(columns?.count ?? columns ?? 1) || 1)
  );
}

/** Plan columns once, in source order. Hidden sections follow their revealing control. */
export function planSectionColumns(schema, values, options = {}) {
  const all = merge(schema, values, undefined).values;
  const { sections } = buildPanelModel(schema, all, { includeAll: true });
  if (options.columns?.balance !== 'estimate') {
    return [sections];
  }
  const columns = Array.from({ length: columnCount(options.columns) }, () => ({
    height: 0,
    sections: [],
  }));
  const ids = new Set(sections.map((section) => section.id));
  const pending = new Map();
  const independent = [];
  for (const section of sections) {
    const height = measure(section, all, options);
    const dependency =
      height === 0 ? revealingSection(section, schema, ids) : undefined;
    const entry = { section, height };
    if (dependency === undefined) {
      independent.push(entry);
    } else {
      const entries = pending.get(dependency) ?? [];
      entries.push(entry);
      pending.set(dependency, entries);
    }
  }
  const placed = new Set();
  function place(entry, column) {
    // Iterative traversal keeps long dependency chains safe.
    const stack = [entry];
    while (stack.length) {
      const { section, height } = stack.pop();
      if (!placed.has(section.id)) {
        placed.add(section.id);
        column.sections.push(section);
        column.height += height;
        stack.push(...(pending.get(section.id) ?? []).slice().reverse());
      }
    }
  }
  const shortest = () =>
    columns.reduce((a, b) => (a.height <= b.height ? a : b));
  for (const entry of independent) {
    place(entry, shortest());
  }
  // Cyclic visibility rules still get a stable place in the initial DOM.
  for (const entries of pending.values()) {
    for (const entry of entries) {
      place(entry, shortest());
    }
  }
  return columns.map((column) => column.sections);
}
