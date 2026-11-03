/**
 * `@link-foundation/ui-components/behavior`: behaviour state machines in
 * Links Notation, their interpreter and the actions registry. This entry
 * point imports nothing from the DOM or from ui-dom, so it runs in Node,
 * workers and tests without `window` or `document`.
 */

export {
  parseMachine,
  parseMachines,
  createMachine,
  MachineError,
  parseDelay,
  toValue,
} from './parse-machine.js';
export { interpret, createManualClock, attrValue } from './interpret.js';
export {
  createActionRegistry,
  dispatchHandler,
  checkHandler,
  fail,
  VOCABULARY_ACTIONS,
} from './actions.js';
export { diagnostic, isUnsafeUrl } from './diagnostics.js';
export {
  TOGGLE_MACHINE,
  DISCLOSURE_MACHINE,
  REFERENCE_MACHINES,
} from './machines/index.js';
