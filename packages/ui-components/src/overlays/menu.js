/** APG menus: one roving item, typeahead, activation and one submenu level. */
import { createRovingTabindex, createTypeahead } from '../a11y/index.js';
import { defineIconElement } from '../icons/icon.js';
import {
  atomOf,
  clockOf,
  emit,
  listen,
  make,
  overlayController,
  registerOverlay,
  watchChildren,
} from './dom.js';
import { createPopover } from './popover.js';

function propertyItems(node, el, ctx) {
  const generated = [];
  defineIconElement(ctx.document.defaultView);
  for (const property of el.properties.filter((p) => p.name === 'item')) {
    const [id, ...props] = property.values;
    const value = (name) =>
      props.find((raw) => Array.isArray(raw) && raw[0] === name)?.[1];
    const item = make(ctx.document, 'div', {
      role: 'menuitem',
      tabindex: '-1',
      'data-item': id,
      'data-label': value('label') ?? id,
    });
    item.append(
      make(ctx.document, 'ui-icon', {
        name: value('icon') ?? 'menu',
        'aria-hidden': 'true',
      }),
      make(ctx.document, 'span', { 'data-part': 'label' }, value('label') ?? id)
    );
    item.addEventListener('ui-select', (event) => {
      for (const handler of props.filter(
        (p) => Array.isArray(p) && p[0] === 'on' && p[1] === 'select'
      )) {
        for (const action of handler.slice(2)) {
          const detail = {
            source: id,
            event: 'select',
            action,
            ...event.detail,
          };
          emit(node, 'ui-action', detail);
          ctx.options.onAction?.(detail, event);
        }
      }
    });
    node.append(item);
    generated.push(item);
  }
  return generated;
}

export function createMenu(node, initial, ctx, options = {}) {
  let el = initial;
  const items = () =>
    [...node.children].filter(
      (child) => child.getAttribute('role') === 'menuitem'
    );
  const roving = createRovingTabindex(items, {
    orientation: options.radial ? 'both' : 'vertical',
  });
  const searchItems = () =>
    items().filter((item) => item.getAttribute('aria-disabled') !== 'true');
  const typeahead = createTypeahead(
    () =>
      searchItems().map(
        (item) => item.getAttribute('data-label') ?? item.textContent
      ),
    { clock: clockOf(ctx) }
  );
  const popup = createPopover(node, el, ctx, {
    menu: true,
    manual: options.manual,
    dismissOutside: options.manual,
    noTrigger: options.noTrigger,
    focusEdge: (last) => roving.focus(last ? items().length - 1 : 0),
    onOpen: () => {
      roving.update();
      roving.focus(0);
      options.onOpen?.();
    },
    onClose: () => {
      typeahead.reset();
      for (const item of items()) {
        for (const sub of item.children) {
          overlayController(sub)?.close(false);
        }
      }
    },
  });
  node.setAttribute('role', 'menu');
  const submenuOf = (item) =>
    [...(item?.children ?? [])].find(
      (child) => child.getAttribute('role') === 'menu'
    );
  const activate = (item) => {
    if (!item || item.getAttribute('aria-disabled') === 'true') {
      return;
    }
    const submenu = submenuOf(item);
    if (submenu) {
      overlayController(submenu)?.open(item);
      return;
    }
    const detail = {
      item: item.dataset.linkId ?? item.dataset.item,
      ...popup.context,
    };
    emit(item, 'ui-select', detail);
    popup.close();
    const parentMenu = node.parentElement?.closest('[role="menu"]');
    overlayController(parentMenu)?.close();
  };
  const detach = [
    listen(node, 'keydown', (event) => {
      if (!items().includes(event.target)) {
        return;
      }
      const item = event.target;
      if (event.key === 'ArrowRight' && submenuOf(item)) {
        event.preventDefault();
        overlayController(submenuOf(item))?.open(item);
        return;
      }
      if (
        event.key === 'ArrowLeft' &&
        node.parentElement?.getAttribute('role') === 'menuitem'
      ) {
        event.preventDefault();
        popup.close();
        node.parentElement.focus();
        return;
      }
      if (roving.handleKeyDown(event)) {
        return;
      }
      if (['Enter', ' '].includes(event.key)) {
        event.preventDefault();
        activate(item);
      } else if (event.key === 'Tab') {
        popup.close(false);
      } else if (!event.ctrlKey && !event.altKey && !event.metaKey) {
        const found = typeahead.handleKey(
          event.key,
          searchItems().indexOf(item)
        );
        if (found >= 0) {
          event.preventDefault();
          roving.focus(items().indexOf(searchItems()[found]));
        }
      }
    }),
    listen(node, 'click', (event) => {
      const item = event.target.closest('[role="menuitem"]');
      if (items().includes(item)) {
        activate(item);
      }
    }),
    listen(node, 'focusin', (event) => {
      const index = items().indexOf(event.target);
      if (index >= 0 && roving.index !== index) {
        roving.focus(index);
      }
    }),
  ];
  const observer = watchChildren(node, () => {
    roving.update();
    for (const item of items()) {
      if (submenuOf(item)) {
        item.setAttribute('aria-haspopup', 'menu');
        item.setAttribute('aria-expanded', 'false');
      }
    }
  });
  let generated = [];

  return {
    ...popup,
    get context() {
      return popup.context;
    },
    items,
    update(next, changed) {
      el = next;
      popup.update(el, changed);
      generated.forEach((item) => item.remove());
      generated = propertyItems(node, el, ctx);
      roving.update();
    },
    disconnect() {
      observer.disconnect();
      detach.forEach((fn) => fn());
      typeahead.reset();
      popup.disconnect();
    },
  };
}
registerOverlay(
  'menu',
  (el, ctx) => make(ctx.document, 'div', { hidden: true }),
  createMenu
);
registerOverlay(
  'menu-item',
  (el, ctx) => make(ctx.document, 'div', { role: 'menuitem', tabindex: '-1' }),
  (node) => ({
    update(el) {
      let label = node.querySelector(':scope > [data-part="label"]');
      if (!label) {
        label = make(node.ownerDocument, 'span', { 'data-part': 'label' });
        node.prepend(label);
      }
      const name = atomOf(el, 'icon');
      let icon = node.querySelector(':scope > ui-icon');
      if (name) {
        defineIconElement(node.ownerDocument.defaultView);
        if (!icon) {
          icon = make(node.ownerDocument, 'ui-icon', { 'aria-hidden': 'true' });
          node.prepend(icon);
        }
        icon.setAttribute('name', name);
      } else {
        icon?.remove();
      }
      label.textContent = atomOf(el, 'label') ?? el.positional[0] ?? el.id;
      node.dataset.label = label.textContent;
      node.setAttribute('aria-disabled', atomOf(el, 'disabled') ?? 'false');
    },
  })
);
registerOverlay(
  'menu-separator',
  (el, ctx) => make(ctx.document, 'div', { role: 'separator' }),
  () => ({})
);
