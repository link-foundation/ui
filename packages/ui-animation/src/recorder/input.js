import { sensitiveTarget } from './redact.js';

export const INPUT_EVENTS = [
  'pointerdown',
  'pointerup',
  'pointermove',
  'pointercancel',
  'keydown',
  'keyup',
  'wheel',
  'input',
  'focusin',
  'focusout',
];
const textOf = (target) => String(target.value ?? target.textContent ?? '');
const keyOf = (event, hidden) =>
  hidden && event.key.length === 1 ? '***' : event.key;
export function inputEvent(event, { handle, redact, isSensitive }, time) {
  const id = handle?.idFor(event.target);
  if (!id) {
    return null;
  }
  const type = event.type;
  let args;
  if (type.startsWith('pointer')) {
    const box = event.target.getBoundingClientRect();
    args = [
      'pointer',
      type.slice(7),
      id,
      ['at', String(event.clientX - box.left), String(event.clientY - box.top)],
      ['button', String(event.button ?? 0)],
      ['pointer', String(event.pointerId ?? 1)],
    ];
  } else if (type.startsWith('key')) {
    const key = keyOf(event, redact && isSensitive(id));
    args = ['key', type.slice(3), key, ['target', id]];
  } else if (type === 'wheel') {
    args = [
      'wheel',
      id,
      String(event.deltaX),
      String(event.deltaY),
      String(event.deltaMode ?? 0),
    ];
  } else if (type === 'input') {
    const hidden = redact && (sensitiveTarget(event.target) || isSensitive(id));
    args = ['text', id, hidden ? '***' : textOf(event.target)];
  } else {
    args = ['focus', type === 'focusin' ? 'in' : 'out', id];
  }
  return { time, kind: 'input', args };
}
