import { applyPreset, equalValues } from '@link-foundation/ui-settings';
import { miniature } from './miniature.js';

export function presetCards(
  context,
  parent,
  ids = [...context.schema.presets.keys()]
) {
  const { node, button, schema, commit, getValues } = context;
  const gallery = node('div', undefined, parent);
  gallery.className = 'settings-cards settings-presets';
  const cards = ids.map((id) => {
    const preset = schema.presets.get(id);
    const card = node('div', undefined, gallery);
    const choose = button(
      preset.label ?? id,
      () => commit(applyPreset(schema, getValues(), id)),
      card
    );
    choose.dataset.preset = id;
    node('p', preset.description ?? '', card);
    const preview = miniature(
      context,
      card,
      applyPreset(schema, getValues(), id),
      { preset }
    );
    return { id, choose, preview };
  });
  return {
    update(values) {
      for (const { id, choose, preview } of cards) {
        const next = applyPreset(schema, values, id);
        choose.setAttribute(
          'aria-pressed',
          String(equalValues(schema, values, next))
        );
        preview.update(next);
      }
    },
    destroy: () => cards.forEach((card) => card.preview.destroy()),
  };
}
