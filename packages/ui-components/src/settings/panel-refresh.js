import { defaults, toLino, applyToRoot } from '@link-foundation/ui-settings';
import { buildPanelModel } from './panel-model.js';
import { refreshSection } from './section-tabs.js';
import { revealingFields } from './section-layout.js';
import { refreshRows } from './panel-rows.js';

export function refreshPanel(
  context,
  { rows, sections, chromes, search, count, presets, cards, peek, changes },
  { values, peeking, tabs, level, sectionLevels, editedKey },
  updateControls
) {
  const { schema, options, messages } = context;
  const shown = peeking ? defaults(schema) : values;
  for (const chrome of chromes) {
    refreshSection(
      chrome,
      {
        values,
        shown,
        level,
        sectionLevels,
        selectedTabs: tabs,
        query: search.value.trim(),
      },
      context
    );
  }
  const model = buildPanelModel(schema, values, {
    query: search.value,
    tabs,
    level,
    sectionLevels,
  });
  keepFirstPlacement(
    model,
    chromes,
    sections,
    schema.fields.get(editedKey),
    options
  );
  refreshRows({
    rows,
    sections,
    model,
    values,
    shown,
    peeking,
    updateControls,
  });
  count.textContent =
    options.formatCount?.(model) ??
    messages.text('count', { count: model.changedCount });
  presets.value = model.activePreset ?? '';
  cards?.update(values);
  peek.setAttribute('aria-pressed', String(peeking));
  changes.value = options.codec?.write(values) ?? toLino(schema, values);
  if (options.previewRoot) {
    applyToRoot(schema, shown, options.previewRoot, {
      project: options.project,
    });
    options.onPreview?.(shown, options.previewRoot);
  }
}

function keepFirstPlacement(model, chromes, groups, edited, options) {
  if (options.columns?.balance !== 'estimate') {
    return;
  }
  const visible = new Set(model.sections.map(({ id }) => id));
  const anchor = edited && groups.get(edited.section ?? '');
  let after = anchor;
  for (const chrome of chromes) {
    const { section } = chrome;
    if (chrome.revealed || !visible.has(section.id)) {
      continue;
    }
    chrome.revealed = true;
    const group = groups.get(section.id);
    if (
      anchor &&
      group !== anchor &&
      revealingFields(section).includes(edited.key)
    ) {
      if (group.parentElement !== anchor.parentElement) {
        after.after(group);
        after = group;
      }
    }
  }
}
