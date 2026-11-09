import { FRAME_STATES, resolveFrame } from './frame-schema.js';
import { frameValues } from './frame-css-values.js';
import { rule } from './frame-css-geometry.js';

const disabled = ":is(:disabled, [disabled], [aria-disabled='true'])";
const selectors = {
  hover: `:hover:not(${disabled})`,
  active: ':active',
  selected:
    ":is([aria-selected='true'], [aria-pressed='true'], [aria-current='page'])",
  focus: ':focus-visible',
  disabled,
};
function patchesFor(ctx, level, state) {
  const patches = [];
  let entry = ctx.frames.get(level);
  while (entry) {
    if (entry.states[state]) {
      patches.unshift(entry.states[state]);
    }
    entry = ctx.frames.get(entry.extends);
  }
  return patches;
}
function geometryPatch(patch) {
  return {
    corners: patch.corners,
    edges: patch.edges,
    ...Object.fromEntries(
      ['stroke', 'style', 'mode']
        .filter((key) => patch[key] !== undefined)
        .map((key) => [key, patch[key]])
    ),
  };
}
function hasGeometry(patch) {
  return (
    Object.keys(patch.corners).length > 0 ||
    Object.keys(patch.edges).length > 0 ||
    ['stroke', 'style', 'mode'].some((key) => patch[key] !== undefined)
  );
}
/** Compound geometry selectors preserve independent state overrides: changing
 * a color while pressed must keep a double edge selected by hover. There are
 * at most five states, so this expansion is bounded to 26 compound subsets. */
export function stateCss(ctx, level, hosts) {
  const patches = new Map(
    FRAME_STATES.map((state) => [state, patchesFor(ctx, level, state)])
  );
  const suffix = (state) =>
    state === 'selected' && ctx.selected
      ? `:is(${ctx.selected.join(', ')})`
      : selectors[state];
  const render = (states, inputs) => {
    const selector = hosts
      .map(
        (host) =>
          host + states.map((state) => `:where(${suffix(state)})`).join('')
      )
      .join(', ');
    const resolved = resolveFrame(ctx.frames, level, states);
    return inputs
      .map((patch) => rule(selector, frameValues(ctx, level, resolved, patch)))
      .join('');
  };
  let css = FRAME_STATES.map((state) =>
    render([state], patches.get(state))
  ).join('');
  const geometryStates = FRAME_STATES.filter((state) =>
    patches.get(state).some(hasGeometry)
  );
  const combinations = [[]];
  for (const state of geometryStates) {
    combinations.push(...combinations.map((previous) => [...previous, state]));
  }
  for (const states of combinations
    .filter((items) => items.length > 1)
    .sort((a, b) => a.length - b.length)) {
    css += render(
      states,
      states.flatMap((state) => patches.get(state).map(geometryPatch))
    );
  }
  return css;
}
