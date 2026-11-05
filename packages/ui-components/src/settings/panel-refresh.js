import { defaults, toLino, applyToRoot } from '@link-foundation/ui-settings';
import { buildPanelModel } from './panel-model.js';
import { refreshRows } from './panel-rows.js';

export function refreshPanel(
  { schema, options },
  { rows, sections, search, count, presets, peek, changes },
  { values, peeking, tabs, level },
  updateControls
) {
  const shown = peeking ? defaults(schema) : values;
  const model = buildPanelModel(schema, values, {
    query: search.value,
    tabs,
    level,
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
    options.formatCount?.(model) ?? `${model.changedCount} changed settings`;
  for (const [id, group] of sections) {
    const tab = tabs[id] ?? schema.sections.find((s) => s.id === id)?.tabs?.[0];
    for (const button of group.querySelectorAll('[data-tab]')) {
      button.setAttribute('aria-pressed', String(button.dataset.tab === tab));
    }
  }
  presets.value = model.activePreset ?? '';
  peek.setAttribute('aria-pressed', String(peeking));
  changes.value = options.codec?.write(values) ?? toLino(schema, values);
  if (options.previewRoot) {
    applyToRoot(schema, shown, options.previewRoot, {
      project: options.project,
    });
    options.onPreview?.(shown, options.previewRoot);
  }
}
