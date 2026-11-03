/** LiNo is the source of overlay state, independent of a renderer. */
export const SURFACE_MACHINE = `surface: machine
  initial closed
  state closed
    on open
      target open
  state open
    on close
      target closed
  part content
    attr data-state
      state
`;

export const TOOLTIP_MACHINE = `tooltip: machine
  initial closed
  state closed
    on enter
      target waiting
  state waiting
    after 500ms
      target open
    on leave
      target closed
    on close
      target closed
  state open
    on enter
      target open
    on leave
      target closing
    on close
      target closed
  state closing
    after 100ms
      target closed
    on enter
      target open
    on close
      target closed
  part content
    attr data-state
      state
`;

export const TABS_MACHINE = `tabs: machine
  initial active
  context
    active ''
  state active
    on select
      do select-tab
`;

export const TOAST_MACHINE = `toast: machine
  initial queued
  state queued
    on show
      target visible
  state visible
    on pause
      target paused
    on close
      target closed
  state paused
    on resume
      target visible
    on close
      target closed
  state closed
`;
