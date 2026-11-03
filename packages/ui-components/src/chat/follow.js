/** Bottom following and keyed prepend anchoring reuse the data range model. */
import { anchorScrollTop } from '../data/virtual-range.js';
export { anchorScrollTop };
export const firstUnread = (messages) =>
  messages.find((m) => m.unread && !m.outgoing)?.id ?? null;

/** Geometry-only follower: called after viewport measurements, never in RO. */
export function createFollow(root, { threshold = 2 } = {}) {
  let following = true;
  const atBottom = () =>
    root.scrollHeight - root.clientHeight - root.scrollTop <= threshold;
  const scroll = () => {
    following = atBottom();
  };
  const leave = (event) => {
    if (
      event.deltaY < 0 ||
      ['ArrowUp', 'PageUp', 'Home'].includes(event.key) ||
      event.type === 'touchstart'
    ) {
      following = false;
    }
  };
  root.addEventListener('scroll', scroll, { passive: true });
  for (const type of ['wheel', 'keydown', 'touchstart']) {
    root.addEventListener(type, leave, { passive: true });
  }
  return {
    state: () => ({ following }),
    pause() {
      following = false;
    },
    toBottom() {
      following = true;
      root.scrollTop = root.scrollHeight;
    },
    refresh() {
      if (following) {
        root.scrollTop = root.scrollHeight;
      }
    },
    disconnect() {
      root.removeEventListener('scroll', scroll);
      for (const type of ['wheel', 'keydown', 'touchstart']) {
        root.removeEventListener(type, leave);
      }
    },
  };
}
