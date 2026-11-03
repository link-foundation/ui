/**
 * `flattenTimeline(model, id)`: a timeline as a flat schedule of plays,
 * `[{ start, id, target }]`, sorted by start time.
 *
 * - the items of a timeline (and of `at` and `parallel`) start together;
 * - `(at TIME ITEM...)` starts its items TIME after its parent;
 * - `(sequence ITEM...)` starts each item when the one before ends;
 * - `(stagger STEP ITEM... (targets A B C))` starts the i-th target (or,
 *   without targets, the i-th item) i * STEP after its parent;
 * - `(play ID)` of a timeline plays it nested.
 * An item ends when its last animation ends (delay + duration * iterations).
 */

import { endTime, resolveTime } from './timing.js';

/**
 * @param {import('./types.js').AnimationModel} model
 * @param {string} id  a timeline or an animation id
 * @param {{ resolveToken?: (path: string) => unknown,
 *   variant?: (a: import('./types.js').Animation) => import('./types.js').Animation,
 *   target?: string|null }} [options]
 * @returns {{ start: number, id: string, target: string|null }[]}
 */
export function flattenTimeline(model, id, options = {}) {
  const out = [];
  const context = {
    model,
    resolveToken: options.resolveToken,
    variant: options.variant ?? ((a) => a),
    out,
    stack: [],
  };
  play(context, { type: 'play', id, target: options.target ?? null }, 0, null);
  return out.sort((a, b) => a.start - b.start);
}

/** Schedule one item at `start`; returns when it ends. */
function schedule(context, item, start, target) {
  switch (item.type) {
    case 'play':
      return play(context, item, start, target);
    case 'at':
      return parallel(
        context,
        item.items,
        start + (resolveTime(item.time, context.resolveToken) ?? 0),
        target
      );
    case 'parallel':
      return parallel(context, item.items, start, target);
    case 'sequence': {
      let cursor = start;
      for (const child of item.items) {
        cursor = schedule(context, child, cursor, target);
      }
      return cursor;
    }
    case 'stagger':
      return stagger(context, item, start, target);
    default:
      return start;
  }
}

function parallel(context, items, start, target) {
  let end = start;
  for (const item of items) {
    end = Math.max(end, schedule(context, item, start, target));
  }
  return end;
}

function stagger(context, item, start, target) {
  const step = resolveTime(item.step, context.resolveToken) ?? 0;
  let end = start;
  if (item.targets && item.targets.length > 0) {
    item.targets.forEach((each, i) => {
      for (const child of item.items) {
        end = Math.max(end, schedule(context, child, start + i * step, each));
      }
    });
    return end;
  }
  item.items.forEach((child, i) => {
    end = Math.max(end, schedule(context, child, start + i * step, target));
  });
  return end;
}

function play(context, item, start, inherited) {
  const { model } = context;
  const targets =
    item.targets && item.targets.length > 0
      ? item.targets
      : [item.target ?? inherited];
  const timeline = model.timelines.get(item.id);
  if (timeline) {
    if (context.stack.includes(item.id)) {
      return start;
    }
    context.stack.push(item.id);
    const end = parallel(context, timeline.items, start, targets[0] ?? null);
    context.stack.pop();
    return end;
  }
  const animation = model.animations.get(item.id);
  if (!animation) {
    return start;
  }
  const length = endTime(context.variant(animation), context.resolveToken);
  for (const target of targets) {
    context.out.push({ start, id: item.id, target: target ?? null });
  }
  return start + length;
}
