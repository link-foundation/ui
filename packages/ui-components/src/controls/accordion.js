/**
 * `accordion`: one disclosure, as a heading with a native button
 * (`aria-expanded`, `aria-controls`) over a labelled `region`. It runs the
 * `disclosure-machine` of the behaviour layer and keeps that machine's
 * events and attributes; focus is the one thing it decides itself, as the
 * APG accordion pattern asks: opening leaves focus on the header, and
 * closing brings focus back only from inside the section (Escape).
 *
 * Enter, Space and a click toggle it. ArrowDown, ArrowUp, Home and End move
 * between the headers of the sibling accordions, which form a group.
 * Every change commits `open` as a `ui-change` event. Only a change after
 * mounting animates (`data-animated`): a section that mounts open has its
 * text at full contrast from the first frame.
 *
 *   (shipping: accordion Shipping (open true) (heading-level 2)
 *     (details: text 'Two to five days.'))
 */

import { createMachine } from '../behavior/parse-machine.js';
import { DISCLOSURE_MACHINE } from '../behavior/machines/index.js';
import {
  changesOf,
  commitValue,
  controlOf,
  driveControl,
  flagOf,
  numberOf,
  partId,
  partOf,
  setAttr,
  startControl,
  stopControl,
  updateLabel,
} from './dom.js';

const machine = createMachine(DISCLOSURE_MACHINE);

/** The header button a key moves to, among the sibling accordions. */
function headerFor(key, trigger, host) {
  const headers = [...(host.parentElement?.children ?? [])]
    .filter((child) => child.localName === 'ui-accordion')
    .map((child) => child.querySelector(':scope [data-part="trigger"]'))
    .filter((header) => !header.disabled);
  const at = headers.indexOf(trigger);
  const count = headers.length;
  const index = {
    ArrowDown: (at + 1) % count,
    ArrowUp: (at - 1 + count) % count,
    Home: 0,
    End: count - 1,
  }[key];
  return headers[index];
}

function onHeaderKey(event) {
  const { altKey, ctrlKey, metaKey, shiftKey, currentTarget } = event;
  if (event.defaultPrevented || altKey || ctrlKey || metaKey || shiftKey) {
    return;
  }
  const next = headerFor(
    event.key,
    currentTarget,
    currentTarget.closest('ui-accordion')
  );
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

function render(control) {
  if (control.mounted) {
    setAttr(control.parts.content, 'data-animated', true);
  }
  if (!control.driven) {
    commitValue(control, 'open', control.service.state === 'open');
  }
}

export const ACCORDION_KIND = Object.freeze({
  tag: 'ui-accordion',
  childrenSlot: (node) => node.children[1],
  attributes: { disabled: 'boolean' },
  eventTarget: (node) => node.firstChild.firstChild,
  create(el, ctx) {
    const doc = ctx.document;
    const node = doc.createElement('ui-accordion');
    const triggerId = partId(el.id, 'trigger');
    const contentId = partId(el.id, 'content');
    const heading = partOf(doc, 'div', 'heading', { role: 'heading' });
    const trigger = partOf(doc, 'button', 'trigger', {
      type: 'button',
      id: triggerId,
      'aria-controls': contentId,
    });
    const label = partOf(doc, 'span', 'label');
    const indicator = partOf(doc, 'span', 'indicator', {
      'aria-hidden': 'true',
    });
    const content = partOf(doc, 'div', 'content', {
      id: contentId,
      role: 'region',
      'aria-labelledby': triggerId,
    });
    trigger.appendChild(label);
    trigger.appendChild(indicator);
    heading.appendChild(trigger);
    node.appendChild(heading);
    node.appendChild(content);
    trigger.addEventListener('keydown', onHeaderKey);
    const control = startControl(node, el, ctx, {
      machine,
      parts: { trigger, content },
      target: trigger,
      render,
    });
    control.label = label;
    control.heading = heading;
    control.value = false;
    control.service.use({
      focus(target) {
        if (target === 'trigger' && content.contains(doc.activeElement)) {
          trigger.focus();
        }
        return true;
      },
    });
    return node;
  },
  update(node, el, changed, ctx) {
    const has = changesOf(node, changed);
    const control = controlOf(node);
    const { trigger } = control.parts;
    if (has('label')) {
      updateLabel(control.label, el, ctx);
    }
    if (has('heading-level')) {
      const level = Math.trunc(numberOf(el, 'heading-level', 3));
      setAttr(
        control.heading,
        'aria-level',
        String(Math.min(6, Math.max(1, level)))
      );
    }
    const disabled = flagOf(el, 'disabled');
    if (has('disabled')) {
      trigger.toggleAttribute('disabled', disabled);
      control.assign({ disabled });
    }
    if (has('open')) {
      const open = flagOf(el, 'open');
      driveControl(control, open ? 'open' : 'close', open, disabled);
    }
    control.mounted = true;
  },
  destroy(node) {
    controlOf(node)?.parts.trigger.removeEventListener('keydown', onHeaderKey);
    stopControl(node);
  },
});
