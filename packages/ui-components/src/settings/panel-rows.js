import { reset, isDefault } from '@link-foundation/ui-settings';
import { buildPanelModel } from './panel-model.js';
import { mountField } from './field-control.js';

export function panelNodes(doc, element) {
  const node = (tag, text, parent = element) => {
    const result = doc.createElement(tag);
    if (text !== undefined) {
      result.textContent = text;
    }
    parent.append(result);
    return result;
  };
  const button = (text, action, parent = element) => {
    const result = node('button', text, parent);
    result.type = 'button';
    result.addEventListener('click', action);
    return result;
  };
  return { node, button };
}

export function createRows({
  node,
  button,
  schema,
  id,
  commit,
  getValues,
  isPeeking,
}) {
  const rows = new Map();
  const sections = new Map();
  const body = node('div');
  for (const section of buildPanelModel(schema, getValues()).sections) {
    const group = node('details', undefined, body);
    group.open = true;
    node('summary', section.label ?? section.id, group);
    // Reset includes filtered-out fields too.
    const keys = section.fields.map((f) => f.key);
    button(
      `Reset ${section.label ?? section.id}`,
      () => commit(reset(schema, getValues(), keys)),
      group
    );
    sections.set(section.id, group);
    for (const field of section.fields) {
      const row = node('div', undefined, group);
      row.className = 'settings-row';
      row.dataset.key = field.key;
      const title = node('div', undefined, row);
      node('strong', field.label ?? field.key, title);
      if (field.description) {
        node('p', field.description, title);
      }
      const container = node('div', undefined, row);
      container.className = 'settings-control';
      const control = mountField(
        container,
        field,
        getValues()[field.key],
        (value) => {
          if (!isPeeking()) {
            commit({ [field.key]: value });
          }
        },
        `${id}-${rows.size}`
      );
      const output = node('output', undefined, row);
      output.setAttribute('aria-label', `${field.label ?? field.key} value`);
      const marker = node('span', 'Changed', title);
      marker.className = 'settings-changed';
      const resetButton = button(
        `Reset ${field.label ?? field.key}`,
        () => commit({ [field.key]: field.default }),
        row
      );
      rows.set(field.key, { row, control, output, marker, resetButton });
    }
  }
  return { rows, sections };
}

export function refreshRows(
  schema,
  { rows, sections, model, values, shown, peeking, updateControls }
) {
  const visible = new Set(
    model.sections.flatMap((s) => s.fields.map((f) => f.key))
  );
  const visibleSections = new Set(model.sections.map((s) => s.id));
  for (const [key, entry] of rows) {
    const changed = !isDefault(schema, key, values[key]);
    entry.row.hidden = !visible.has(key);
    entry.row.toggleAttribute('data-changed', changed);
    entry.marker.hidden = !changed;
    entry.resetButton.disabled = !changed || peeking;
    entry.output.textContent = `${Array.isArray(shown[key]) ? shown[key].join(', ') : shown[key]}${schema.fields.get(key).unit ?? ''}`;
    if (updateControls) {
      entry.control.update(shown[key]);
    }
  }
  for (const [key, group] of sections) {
    group.hidden = !visibleSections.has(key);
  }
}
