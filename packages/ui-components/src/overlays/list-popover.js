/** Connect a select's existing list machine to native top-layer positioning.
 * Without the Popover API the control retains its CSS listbox fallback. */
import { positionFloating } from './position.js';

export function connectListPopover(control) {
  const { input, listbox } = control.parts;
  if (typeof listbox.showPopover !== 'function') {
    return () => {};
  }
  listbox.setAttribute('popover', 'auto');
  let cleanup;
  const sync = () => {
    if (control.service.state === 'open') {
      if (!listbox.matches(':popover-open')) {
        listbox.showPopover();
        listbox.style.width = `${input.getBoundingClientRect().width}px`;
        cleanup = positionFloating(input, listbox, { offset: 4 });
      }
    } else {
      cleanup?.();
      cleanup = undefined;
      if (listbox.matches(':popover-open')) {
        listbox.hidePopover();
      }
    }
  };
  const onToggle = (event) => {
    if (event.newState === 'closed' && !listbox.matches(':popover-open')) {
      control.service.send('close');
    }
  };
  listbox.addEventListener('toggle', onToggle);
  const unsubscribe = control.service.subscribe(sync);
  return () => {
    unsubscribe();
    listbox.removeEventListener('toggle', onToggle);
    cleanup?.();
    if (listbox.matches(':popover-open')) {
      listbox.hidePopover();
    }
  };
}
