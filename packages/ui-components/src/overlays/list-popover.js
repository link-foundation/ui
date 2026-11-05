/** Position lists in the top layer, or a body portal on older browsers. */
import { positionFloating } from './position.js';

export function connectListPopover(control) {
  const { input, listbox } = control.parts;
  const doc = listbox.ownerDocument;
  const native = typeof listbox.showPopover === 'function';
  if (native) {
    listbox.setAttribute('popover', 'auto');
  }
  const marker = doc.createComment('listbox');
  listbox.before(marker);
  let shell;
  let cleanup;
  const portal = () => {
    if (shell) {
      return;
    }
    shell = doc.createElement(control.node.localName);
    shell.setAttribute('data-list-portal', '');
    // Preserve theme scoping and control selectors outside clipped labels/panels.
    for (const name of ['class', 'style', 'data-theme']) {
      const value = control.node.getAttribute(name);
      if (value !== null) {
        shell.setAttribute(name, value);
      }
    }
    const style = doc.defaultView.getComputedStyle(control.node);
    for (const property of Array.from({ length: style.length }, (_, i) =>
      style.item(i)
    )) {
      if (property.startsWith('--')) {
        shell.style.setProperty(property, style.getPropertyValue(property));
      }
    }
    const theme = control.node
      .closest('[data-theme]')
      ?.getAttribute('data-theme');
    if (theme !== undefined) {
      shell.setAttribute('data-theme', theme);
    }
    doc.body.appendChild(shell);
    shell.appendChild(listbox);
  };
  const restore = () => {
    if (shell) {
      marker.after(listbox);
      shell.remove();
      shell = undefined;
    }
  };
  const sync = () => {
    const external =
      control.node.localName === 'ui-select' &&
      input.getAttribute('aria-labelledby') !== control.parts.label.id;
    if (external) {
      portal();
    }
    if (control.service.state === 'open') {
      if (!cleanup) {
        if (!native && input.getClientRects().length) {
          portal();
        }
        if (native) {
          listbox.showPopover();
        }
        Object.assign(listbox.style, {
          margin: '0',
          inset: 'auto',
          zIndex: '1000',
        });
        cleanup = input.getClientRects().length
          ? positionFloating(input, listbox, {
              offset: 4,
              size: () => {
                const style = doc.defaultView.getComputedStyle(control.node);
                const pixels = (name) => {
                  const value = Number.parseFloat(style.getPropertyValue(name));
                  return Number.isFinite(value) ? value : undefined;
                };
                return {
                  minWidth: pixels('--menu-min-width'),
                  maxHeight: pixels('--menu-max-height') ?? 320,
                };
              },
            })
          : () => {};
      }
    } else {
      cleanup?.();
      cleanup = undefined;
      if (native && listbox.matches(':popover-open')) {
        listbox.hidePopover();
      }
      if (!external) {
        restore();
      }
    }
  };
  const onToggle = (event) => {
    if (event.newState === 'closed' && !listbox.matches(':popover-open')) {
      control.service.send('close');
    }
  };
  const outside = (event) => {
    if (
      !control.node.contains(event.target) &&
      !listbox.contains(event.target)
    ) {
      control.service.send('close');
    }
  };
  listbox.addEventListener('toggle', onToggle);
  doc.addEventListener('pointerdown', outside);
  control.syncListPopover = sync;
  const unsubscribe = control.service.subscribe(sync);
  return () => {
    delete control.syncListPopover;
    unsubscribe();
    listbox.removeEventListener('toggle', onToggle);
    doc.removeEventListener('pointerdown', outside);
    cleanup?.();
    if (native && listbox.matches(':popover-open')) {
      listbox.hidePopover();
    }
    restore();
    marker.remove();
  };
}
