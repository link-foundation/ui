/**
 * The reference machines as text, so they load without a file system or a
 * bundler. They are byte-equal to the `.lino` files next to this module;
 * tests/behavior/parse-machine.test.js checks that they stay in sync.
 */

/** A two-state toggle button (`aria-pressed`). */
export const TOGGLE_MACHINE = `toggle-machine: machine
  initial off
  context
    pressed false
    disabled false
  action set-pressed
    set pressed true
  action clear-pressed
    set pressed false
  state off
    on toggle
      target on
      do set-pressed
      when not-disabled
  state on
    on toggle
      target off
      do clear-pressed
      when not-disabled
  part root
    attr aria-pressed
      context pressed
    key Enter toggle
    key Space toggle
    on press toggle
`;

/**
 * A disclosure (`aria-expanded`): opening focuses the content, closing
 * restores focus to the trigger and hides the content after 500 ms.
 */
export const DISCLOSURE_MACHINE = `disclosure-machine: machine
  initial closed
  context
    disabled false
  action focus-content
    focus content
  action restore-focus
    focus trigger
  state closed
    on toggle
      target open
      when not-disabled
    on open
      target open
      when not-disabled
  state open
    entry focus-content
    exit restore-focus
    on toggle
      target closing
    on close
      target closing
  state closing
    after 500ms
      target closed
    on toggle
      target open
      when not-disabled
    on open
      target open
      when not-disabled
  part trigger
    attr aria-expanded
      in open
    attr data-state
      state
    key Enter toggle
    key Space toggle
    on press toggle
  part content
    attr hidden
      present
        in closed
    attr data-state
      state
    key Escape close
`;

/** The reference machines by their element ID. */
export const REFERENCE_MACHINES = Object.freeze({
  'toggle-machine': TOGGLE_MACHINE,
  'disclosure-machine': DISCLOSURE_MACHINE,
});
