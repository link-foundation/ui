/**
 * Diagnostics of the animation model and the validators, in the shape of
 * ui-core diagnostics: `{ code, severity, message, at }`, where `at` names
 * the animation or timeline (`element`) and the part (`property`, `track`).
 */

const of = (at) =>
  at.element === undefined || at.element === null ? '' : ` of "${at.element}"`;
const text = (at) => (at.text === undefined ? '' : ` "${at.text}"`);
const track = (at) => (at.track === undefined ? '' : ` "${at.track}"`);

const MESSAGES = {
  'anonymous-animation': () =>
    'An animation or timeline has no id; write (NAME: animation ...) so that timelines and triggers can play it',
  'unknown-sublink': (at) =>
    `The ${at.kind}${of(at)} has the unknown part${text(at)}; it is ignored`,
  'invalid-value': (at) =>
    `The ${at.property}${of(at)} has the invalid value${text(at)}; expected ${at.expected}`,
  'unknown-easing': (at) =>
    `The easing${of(at)} is unknown${text(at)}; use a name (standard, linear, ...), (cubic-bezier a b c d), (steps n) or (spring (stiffness k) (damping c) (mass m))`,
  'empty-track': (at) =>
    `The track${track(at)}${of(at)} has no (key OFFSET VALUE)`,
  'key-offset-range': (at) =>
    `A key of the track${track(at)}${of(at)} has the offset${text(at)}; key offsets are numbers from 0 to 1`,
  'key-offset-order': (at) =>
    `The keys of the track${track(at)}${of(at)} are not sorted: the offset${text(at)} comes after a larger one`,
  'unknown-effect': (at) =>
    `The effect${text(at)}${of(at)} is not registered; register it with registerEffect(name, fn)`,
  'unknown-state': (at) =>
    `The trigger${of(at)} has the unknown state${text(at)}; a state is hover, focus, pressed or disabled`,
  'unknown-animation': (at) =>
    `The ${at.property}${of(at)} plays${text(at)}, which is not an animation or timeline`,
  'timeline-cycle': (at) =>
    `The timeline${of(at)} plays itself through${text(at)}; timelines must not form a cycle`,
  'persistent-fill': (at) =>
    `The animation${of(at)} has (fill ${at.fill}) on the ${at.track} track: the final ${at.track} stays on the element after it ends and breaks later layout (immortality issue-7, R19); use (fill none) or (fill backwards), or write (persist true) if the end state must stay`,
  flash: (at) =>
    `The ${at.track} track${of(at)} flashes ${at.flashes} times within one second (WCAG 2.3.1 allows at most ${at.limit}); slow it down, soften the change below 10% luminance, or remove it`,
  'missing-reduced-motion': (at) =>
    `The animation${of(at)} moves (${at.track}) for ${at.duration}ms but has no (reduced-motion ...) block; under reduced motion only its opacity tracks will play`,
};

/**
 * @param {string} code
 * @param {'error'|'warning'|'info'} severity
 * @param {Record<string, any>} at
 * @returns {import('./types.js').Diagnostic}
 */
export function animationDiagnostic(code, severity, at) {
  return { code, severity, message: MESSAGES[code](at), at };
}
