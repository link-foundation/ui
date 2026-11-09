import { positionFloating } from '../overlays/position.js';
import { partOf, setText, textOf } from './dom.js';

/** A manual top-layer dialog, revealed only after Floating UI has positioned it. */
export function colorPopover(control, el) {
  if (control.popover || textOf(el, 'mode') !== 'popover') {
    return;
  }
  const { node, parts } = control;
  const doc = node.ownerDocument;
  const trigger = partOf(doc, 'button', 'swatch', {
    type: 'button',
    'aria-haspopup': 'dialog',
    'aria-expanded': 'false',
  });
  const dialog = partOf(doc, 'div', 'chooser', {
    role: 'dialog',
    popover: 'manual',
    hidden: '',
    id: `${parts.input.id}-chooser`,
  });
  trigger.setAttribute('aria-controls', dialog.id);
  node.append(trigger, dialog);
  dialog.append(parts.rgb, parts.palette);
  parts.indicator.hidden = true;
  let opened = false;
  let stopPosition;
  function close(restore = false) {
    if (!opened) {
      return;
    }
    opened = false;
    stopPosition?.();
    dialog.hidePopover?.();
    dialog.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    if (restore) {
      trigger.focus();
    }
  }
  trigger.addEventListener('click', () => {
    if (opened) {
      close();
      return;
    }
    opened = true;
    dialog.hidden = false;
    dialog.style.visibility = 'hidden';
    dialog.showPopover?.();
    trigger.setAttribute('aria-expanded', 'true');
    let positioned = false;
    stopPosition = positionFloating(trigger, dialog, {
      onUpdate() {
        if (!positioned && opened) {
          positioned = true;
          dialog.style.visibility = 'visible';
          parts.rgb.querySelector('input[type=range]')?.focus();
        }
      },
    });
  });
  const outside = (event) => {
    if (!dialog.contains(event.target) && !trigger.contains(event.target)) {
      close();
    }
  };
  const escape = (event) => {
    if (opened && event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      close(true);
    }
  };
  doc.addEventListener('pointerdown', outside);
  doc.addEventListener('focusin', outside);
  dialog.addEventListener('keydown', escape);
  const stop = control.stop;
  control.stop = () => {
    close();
    doc.removeEventListener('pointerdown', outside);
    doc.removeEventListener('focusin', outside);
    stop();
  };
  control.popover = {
    update(next) {
      const active = textOf(next, 'mode') === 'popover';
      trigger.hidden = !active;
      parts.indicator.hidden = active;
      const parent = active ? dialog : node;
      for (const part of [parts.rgb, parts.palette]) {
        if (part.parentNode !== parent) {
          parent.append(part);
        }
      }
      if (!active) {
        close();
      }
      const label = textOf(next, 'label') || next.id;
      setText(trigger, label);
      dialog.setAttribute('aria-label', label);
      trigger.disabled = Boolean(
        control.service.context.disabled || control.service.context.readonly
      );
      if (trigger.disabled) {
        close();
      }
    },
  };
}

/** Raw LiNo property lists to named palette groups. */
export function paletteGroups(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const groups =
    typeof raw[0]?.[0] === 'string' && raw[0][0] === 'name' ? [raw] : raw;
  return groups.map((group) => {
    if (group?.name) {
      return group;
    }
    const props = new Map(group);
    const colors = group.find((item) => item[0] === 'colors')?.slice(1) ?? [];
    return {
      name: props.get('name'),
      colors: colors.map((color) => {
        const values = new Map(color);
        return { name: values.get('name'), hex: values.get('hex') };
      }),
    };
  });
}
