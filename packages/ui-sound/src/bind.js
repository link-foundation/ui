import { parseLinks } from '@link-foundation/ui-core';

export const DEFAULT_SOUND_MAPPING = `sound-map
  press click
  activate click
  hover hover
  toggle toggle
  change toggle
  select select
  open open
  close close
  type type
  scan scan
  intro intro
  notify notify
`;

/** Bind to the merged #33 DOM callback and interpreter subscription APIs. */
export function bindSound(
  player,
  { mapping = DEFAULT_SOUND_MAPPING, machines = [] } = {}
) {
  const entries = parseLinks(mapping);
  if (entries.length !== 1 || entries[0][0] !== 'sound-map') {
    throw new TypeError('Expected sound-map');
  }
  const table = new Map();
  for (const row of entries[0].slice(1)) {
    if (
      !Array.isArray(row) ||
      row.length !== 2 ||
      row.some((v) => typeof v !== 'string')
    ) {
      throw new TypeError('Expected event and cue');
    }
    table.set(...row);
  }
  let active = true;
  // ui-dom calls onAction once per handler action. One interaction can contain
  // several actions, so deduplicate by the actual DOM event and sound name.
  const seen = new WeakMap();
  const onAction = (detail, event) => {
    if (!active) {
      return;
    }
    const name = table.get(detail.event);
    if (!name) {
      return;
    }
    if (event && typeof event === 'object') {
      const names = seen.get(event) ?? new Set();
      if (names.has(name)) {
        return;
      }
      names.add(name);
      seen.set(event, names);
    }
    player.play(name);
  };
  const stops = machines.map((machine) =>
    machine.subscribe((snapshot) => {
      if (active && snapshot.event) {
        const name = table.get(snapshot.event.type);
        if (name) {
          player.play(name);
        }
      }
    })
  );
  return {
    onAction,
    dispose() {
      active = false;
      stops.forEach((stop) => stop());
    },
  };
}
