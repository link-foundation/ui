import { reset, isDefault } from '@link-foundation/ui-settings';
import { buildPanelModel } from './panel-model.js';
import { mountField } from './field-control.js';

export function panelNodes(doc, element, messages) {
  const node = (tag, text, parent = element) => {
    const result = doc.createElement(tag);
    if (text !== undefined) {
      if (typeof text === 'function') {
        messages.bind(() => {
          result.textContent = text();
        });
      } else {
        result.textContent = text;
      }
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

export function createPanelHeader({
  doc,
  element,
  options,
  messages,
  close,
  onSearch,
}) {
  element.setAttribute('role', 'region');
  if (options.label) {
    element.setAttribute('aria-label', options.label);
  } else {
    messages.attr(element, 'aria-label', 'settings');
  }
  const { node, button } = panelNodes(doc, element, messages);
  const heading = node('h2', options.label ?? messages.message('settings'));
  heading.tabIndex = -1;
  if (options.mode === 'drawer') {
    button(messages.message('close'), close);
  }
  const search = node('input');
  search.type = 'search';
  messages.bind(() => {
    search.placeholder = messages.text('search');
  });
  messages.attr(search, 'aria-label', 'search');
  search.addEventListener('input', onSearch);
  const count = node('p');
  count.setAttribute('aria-live', 'polite');
  count.setAttribute('aria-atomic', 'true');
  return { node, button, heading, search, count };
}

function createTabs({ section, node, button, group, setTab, messages }) {
  if (section.tabs?.length) {
    const tabs = node('div', undefined, group);
    tabs.setAttribute('role', 'group');
    messages.attr(tabs, 'aria-label', 'tabs', {
      label: section.label ?? section.id,
    });
    for (const tab of section.tabs) {
      const choose = button(tab, () => setTab(section.id, tab), tabs);
      choose.dataset.tab = tab;
    }
  }
}

export function createRows({
  node,
  button,
  schema,
  id,
  commit,
  getValues,
  isPeeking,
  options,
  setTab,
  messages,
}) {
  const rows = new Map();
  const sections = new Map();
  const body = node('div');
  body.className = 'settings-sections';
  body.style.setProperty('--settings-columns', String(options.columns ?? 1));
  for (const section of buildPanelModel(schema, getValues(), {
    includeAll: true,
  }).sections) {
    const group = node('details', undefined, body);
    group.open = true;
    node('summary', section.label ?? section.id, group);
    // Reset includes filtered-out fields too.
    const keys = section.fields.map((f) => f.key);
    button(
      messages.message('reset', { label: section.label ?? section.id }),
      () => commit(reset(schema, getValues(), keys)),
      group
    );
    sections.set(section.id, group);
    createTabs({ section, node, button, group, setTab, messages });
    const groups = new Map();
    for (const field of section.fields) {
      let parent = group;
      if (field.props.group) {
        if (!groups.has(field.props.group)) {
          const fieldset = node('fieldset', undefined, group);
          fieldset.className = 'settings-group';
          node('legend', String(field.props.group), fieldset);
          groups.set(field.props.group, fieldset);
        }
        parent = groups.get(field.props.group);
      }
      const row = node('div', undefined, parent);
      row.className = 'settings-row';
      row.dataset.key = field.key;
      const title = node('div', undefined, row);
      node('strong', field.label ?? field.key, title);
      if (field.description) {
        node('p', field.description, title);
      }
      const container = node('div', undefined, row);
      container.className = 'settings-control';
      const mount = options.mountControl ?? mountField;
      const control = mount(
        container,
        field,
        getValues()[field.key],
        (value) => {
          if (!isPeeking()) {
            commit({ [field.key]: value });
          }
        },
        `${id}-${rows.size}`,
        { messages }
      );
      const output = node('output', undefined, row);
      messages.attr(output, 'aria-label', 'value', {
        label: field.label ?? field.key,
      });
      const marker = node('span', messages.message('changed'), title);
      marker.className = 'settings-changed';
      const resetButton = button(
        messages.message('reset', { label: field.label ?? field.key }),
        () => commit({ [field.key]: field.default }),
        row
      );
      const preview =
        field.props.preview &&
        options.mountPreview?.({
          container: node('div', undefined, row),
          field,
          values: getValues(),
        });
      rows.set(field.key, {
        row,
        control,
        output,
        marker,
        resetButton,
        preview,
      });
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
    entry.preview?.update(shown, schema.fields.get(key));
    if (updateControls) {
      entry.control.update(shown[key]);
    }
  }
  for (const [key, group] of sections) {
    group.hidden = !visibleSections.has(key);
    for (const fieldset of group.querySelectorAll('.settings-group')) {
      fieldset.hidden = [...fieldset.querySelectorAll('.settings-row')].every(
        (row) => row.hidden
      );
    }
  }
}
