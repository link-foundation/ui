import { fieldVisible, matchesCondition } from './conditions.js';

/** ARIA tabs with automatic activation and roving keyboard focus. */
export function tabBar(
  context,
  parent,
  labels,
  choose,
  id,
  { label, shared = false }
) {
  const { node, button } = context;
  const bar = node('div', undefined, parent);
  bar.setAttribute('role', 'tablist');
  bar.setAttribute('aria-label', label);
  const sharedPanel = shared ? node('div', undefined, parent) : null;
  const entries = labels.map((value, index) => {
    const tab = button(value, () => choose(value), bar);
    tab.dataset.tab = value;
    tab.id = `${id}-tab-${index}`;
    tab.setAttribute('role', 'tab');
    const panel = sharedPanel ?? node('div', undefined, parent);
    panel.id = shared ? `${id}-panel` : `${id}-panel-${index}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', tab.id);
    tab.setAttribute('aria-controls', panel.id);
    tab.addEventListener('keydown', (event) => {
      const visible = entries.filter((e) => !e.tab.hidden);
      const current = visible.findIndex((e) => e.tab === tab);
      let next;
      if (event.key === 'Home') {
        next = 0;
      } else if (event.key === 'End') {
        next = visible.length - 1;
      } else if (
        ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)
      ) {
        const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1;
        next = (current + direction + visible.length) % visible.length;
      }
      if (next !== undefined) {
        event.preventDefault();
        choose(visible[next].value);
        visible[next].tab.focus();
      }
    });
    return { value, tab, panel };
  });
  return {
    bar,
    entries,
    sharedPanel,
    update(active, available = labels) {
      for (const entry of entries) {
        entry.tab.hidden = !available.includes(entry.value);
        const selected = !entry.tab.hidden && entry.value === active;
        entry.tab.setAttribute('aria-selected', String(selected));
        entry.tab.tabIndex = selected ? 0 : -1;
        if (!shared) {
          entry.panel.hidden = !selected || entry.tab.hidden;
        }
        if (shared && selected) {
          sharedPanel.setAttribute('aria-labelledby', entry.tab.id);
        }
      }
    },
  };
}

export function sectionChrome(context, section, group) {
  const { id, setTab, setSectionLevel, messages } = context;
  const key = `${id}-section-${section.id}`;
  const levels = section.levels?.length
    ? tabBar(
        context,
        group,
        section.levels,
        (level) => setSectionLevel(section.id, level),
        `${key}-levels`,
        {
          label: messages.text('levels', {
            label: section.label ?? section.id,
          }),
          shared: true,
        }
      )
    : null;
  // Level panels own the level preview; fields retain their identity outside these panels.
  const tabs = section.tabs?.length
    ? tabBar(
        context,
        levels?.sharedPanel ?? group,
        section.tabs,
        (tab) => setTab(section.id, tab),
        key,
        { label: messages.text('tabs', { label: section.label ?? section.id }) }
      )
    : null;
  const preview = mountSectionPreview(
    context,
    section,
    levels?.sharedPanel ?? group
  );
  return {
    tabs,
    levels,
    preview,
    section,
    content: levels?.sharedPanel ?? group,
  };
}

export function refreshSection(chrome, state, context) {
  const { section, tabs, levels, preview } = chrome;
  const { values, shown, level, sectionLevels, selectedTabs, query } = state;
  const activeLevel = sectionLevels[section.id] ?? level ?? section.levels?.[0];
  if (tabs) {
    const available = section.tabs.filter((tab) =>
      section.fields.some(
        (field) =>
          field.props.tab === tab &&
          fieldVisible(
            field,
            values,
            { tabs: { [section.id]: tab }, level: activeLevel },
            section
          ) &&
          `${field.key} ${field.label ?? ''} ${field.description ?? ''} ${section.label ?? ''}`
            .toLocaleLowerCase()
            .includes(query.toLocaleLowerCase())
      )
    );
    if (!available.includes(selectedTabs[section.id] ?? section.tabs[0])) {
      selectedTabs[section.id] = available[0];
    }
    tabs.update(selectedTabs[section.id] ?? section.tabs[0], available);
    tabs.bar.hidden = available.length === 0;
    tabs.bar.setAttribute(
      'aria-label',
      context.messages.text('tabs', { label: section.label ?? section.id })
    );
  }
  if (levels) {
    levels.update(activeLevel);
    for (const entry of levels.entries) {
      const owns = section.fields.some(
        (field) =>
          field.props.level === entry.value &&
          matchesCondition(field.props['visible-when'], values) &&
          values[field.key] !== null
      );
      entry.tab.toggleAttribute('data-owned', owns);
      entry.tab.setAttribute(
        'aria-label',
        `${entry.value}${owns ? `: ${context.messages.text('levelOwned')}` : ''}`
      );
    }
  }
  preview?.update?.(shown, section, activeLevel);
  chrome.presets?.update(values);
}

function mountSectionPreview(context, section, parent) {
  if (!section.preview) {
    return undefined;
  }
  const container = context.node('div', undefined, parent);
  container.className = 'settings-sticky-preview';
  return context.options.mountPreview?.({
    container,
    section,
    values: context.getValues(),
    level: section.levels?.[0],
  });
}
