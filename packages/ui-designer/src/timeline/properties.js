/** Timeline selection reuses the designer's Properties dock. */
import { formatLinks } from '@link-foundation/ui-core';
import { NAMED_EASINGS } from '@link-foundation/ui-animation';
import { element } from '../dom.js';

export function timelineProperties(panel, selected, item, commit) {
  panel.replaceChildren();
  const document = panel.ownerDocument;
  const field = (name, value, callback, choices) => {
    const label = element(document, 'label', {}, name);
    const input = element(document, choices ? 'select' : 'input', {
      'aria-label': name,
    });
    if (choices) {
      for (const choice of choices) {
        input.append(element(document, 'option', { value: choice }, choice));
      }
    }
    input.value = value;
    input.addEventListener('change', () => callback(input.value));
    label.append(input);
    panel.append(label);
  };
  const first = selected[0];
  if (!first) {
    return;
  }
  if (first.recording) {
    const event = item.events[first.index];
    if (!event) {
      return;
    }
    field('Event time (ms)', event.timeMs, (value) =>
      commit([{ ...first, type: 'event-move', ms: Number(value) }])
    );
    field(
      'Event action',
      formatLinks([event.action], { style: 'inline' }).trim(),
      (value) => commit([{ ...first, type: 'event-action', value }])
    );
  } else {
    const key = item.tracks[first.track]?.keys[first.index];
    if (!key) {
      return;
    }
    field('Key value', key.value, (value) =>
      commit([{ ...first, type: 'key-value', value }])
    );
    field(
      'Key easing',
      key.easing ?? 'linear',
      (value) => commit([{ ...first, type: 'key-easing', value }]),
      Object.keys(NAMED_EASINGS)
    );
    field('Duration (ms)', item.durationMs, (value) =>
      commit([{ id: item.id, type: 'duration', ms: Number(value) }])
    );
  }
}
