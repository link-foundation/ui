import { defaults, toLino, applyToRoot } from '@link-foundation/ui-settings';
import { buildPanelModel } from './panel-model.js';
import { refreshSection } from './section-tabs.js';
import { refreshRows } from './panel-rows.js';

export function refreshPanel(
  context,
  { rows, sections, chromes, search, count, presets, cards, peek, changes },
  { values, peeking, tabs, level, sectionLevels },
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
  refreshRows(schema, {
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
