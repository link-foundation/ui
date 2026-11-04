/** Timeline selection reuses the designer's Properties dock. */
import { formatLinks } from '@link-foundation/ui-core';
import { NAMED_EASINGS } from '@link-foundation/ui-animation';
import { element } from '../dom.js';

export function timelineProperties(panel, selected, item, commit, command) {
  const fields = new Set();
  const document = panel.ownerDocument;
  const field = (name, value, callback, choices) => {
    fields.add(name);
    let label = [...panel.children].find(
      (node) => node.dataset.timelineField === name
    );
    if (!label) {
      label = element(document, 'label', { 'data-timeline-field': name }, name);
      const input = element(document, choices ? 'select' : 'input', {
        'aria-label': name,
      });
      if (choices) {
        for (const choice of choices) {
          input.append(element(document, 'option', { value: choice }, choice));
        }
      }
      label.append(input);
      panel.append(label);
    }
    const input = label.querySelector('input,select');
    if (input.value !== String(value)) {
      input.value = value;
    }
    input.onchange = () => callback(input.value);
    input.onkeydown = (event) => {
      // Keep native undo for an uncommitted text edit; committed fields use history.
      if (
        command &&
        input.value === String(value) &&
        (event.ctrlKey || event.metaKey) &&
        event.key.toLowerCase() === 'z'
      ) {
        event.preventDefault();
        event.stopPropagation();
        void command(event.shiftKey ? 'redo' : 'undo');
      }
    };
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
  for (const node of [...panel.children]) {
    if (!fields.has(node.dataset.timelineField)) {
      node.remove();
    }
  }
}
