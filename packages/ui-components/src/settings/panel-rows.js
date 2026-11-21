import { reset } from '@link-foundation/ui-settings';
import { buildPanelModel } from './panel-model.js';
import { planSectionColumns, columnCount } from './section-layout.js';
import { presetCards } from './preset-cards.js';
import { sectionChrome } from './section-tabs.js';
import { createFieldRow } from './field-row.js';

export function panelNodes(doc, element, messages) {
  const node = (tag, text, parent = element) => {
    const result = doc.createElement(tag);
    if (text !== undefined) {
      if (typeof text === 'function') {
        messages.bind(() => {
          result.textContent = text();
        }, result);
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

export function createRows(context) {
  const { node, button, schema, options, commit, getValues, messages } =
    context;
  const rows = new Map();
  const sections = new Map();
  const body = node('div');
  body.className = 'settings-sections';
  body.style.setProperty(
    '--settings-columns',
    String(columnCount(options.columns))
  );
  const plan = planSectionColumns(schema, getValues(), options);
  const chromes = [];
  // Reserve positions first, then mount in schema order for stable control IDs.
  const definitions = buildPanelModel(schema, getValues(), {
    includeAll: true,
  }).sections;
  for (const column of plan) {
    const parent =
      options.columns?.balance === 'estimate'
        ? node('div', undefined, body)
        : body;
    if (parent !== body) {
      parent.className = 'settings-column';
    }
    for (const section of column) {
      sections.set(section.id, node('details', undefined, parent));
    }
  }
  for (const section of definitions) {
    const group = sections.get(section.id);
    group.open = true;
    const summary = node('summary', section.label ?? section.id, group);
    // Reset includes filtered-out fields too.
    const keys = section.fields.map((f) => f.key);
    button(
      messages.message('reset', { label: section.label ?? section.id }),
      () => commit(reset(schema, getValues(), keys)),
      group
    );
    if (section.description) {
      node('p', section.description, group);
    }
    const chrome = sectionChrome(context, section, group);
    chrome.summary = summary;
    if (section.presets?.length) {
      chrome.presets = presetCards(context, chrome.content, section.presets);
    }
    chromes.push(chrome);
    const groups = new Map();
    for (const field of section.fields) {
      mountRow(context, { field, chrome, groups, rows });
    }
  }
  return { rows, sections, chromes };
}

function mountRow(context, { field, chrome, groups, rows }) {
  const { node, id, commit, getValues, options, messages } = context;
  let parent =
    chrome.tabs?.entries.find((e) => e.value === field.props.tab)?.panel ??
    chrome.content;
  if (field.props.group) {
    const groupKey = `${parent.id}/${field.props.group}`;
    if (!groups.has(groupKey)) {
      const fieldset = node('fieldset', undefined, parent);
      fieldset.className = 'settings-group';
      node('legend', String(field.props.group), fieldset);
      groups.set(groupKey, fieldset);
    }
    parent = groups.get(groupKey);
  }
  const row = createFieldRow(
    parent,
    field,
    {
      id: `${id}-${rows.size}`,
      messages,
      slots: options.slots,
      layout: options.layout,
      mountControl: options.mountControl,
      mountPreview: options.mountPreview,
    },
    getValues(),
    (value) => commit({ [field.key]: value })
  );
  rows.set(field.key, row);
}

export function refreshRows({
  rows,
  sections,
  model,
  values,
  shown,
  peeking,
  updateControls,
}) {
  const visible = new Set(
    model.sections.flatMap((s) => s.fields.map((f) => f.key))
  );
  const visibleSections = new Set(model.sections.map((s) => s.id));
  for (const [key, entry] of rows) {
    entry.update(values, {
      shown,
      visible: visible.has(key),
      peek: peeking,
      updateControl: updateControls,
    });
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
