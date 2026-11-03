/** A bounded toast queue. Injected time makes pause/resume deterministic. */
import { interpret } from '../behavior/index.js';
import { TOAST_MACHINE } from './machines/index.js';

export function createToastQueue({
  max = 3,
  duration = 5000,
  clock,
  onChange = () => {},
}) {
  const entries = new Map();
  const now = () => clock.now ?? Date.now();
  const notify = () => onChange([...entries.values()]);
  const cancel = (entry) => {
    clock.clearTimeout(entry.timer);
    entry.timer = undefined;
  };
  const arm = (entry) => {
    if (entry.remaining <= 0) {
      return;
    }
    entry.started = now();
    entry.timer = clock.setTimeout(() => close(entry.id), entry.remaining);
  };
  const fill = () => {
    let visible = [...entries.values()].filter((e) =>
      ['visible', 'paused'].includes(e.service.state)
    ).length;
    for (const entry of entries.values()) {
      if (entry.service.state === 'queued' && visible < max) {
        entry.service.send('show');
        visible++;
        arm(entry);
      }
    }
    notify();
  };
  const close = (id) => {
    const entry = entries.get(id);
    if (!entry) {
      return;
    }
    cancel(entry);
    entry.service.send('close');
    entry.service.stop();
    entries.delete(id);
    entry.onClose?.();
    fill();
  };
  return {
    entries,
    push(id, options = {}) {
      if (entries.has(id)) {
        return;
      }
      const ms = Number(options.duration ?? duration);
      entries.set(id, {
        id,
        ...options,
        remaining: Number.isFinite(ms) ? Math.max(0, ms) : duration,
        reasons: new Set(),
        service: interpret(TOAST_MACHINE, { clock }),
      });
      fill();
    },
    close,
    pause(id, reason = 'hover') {
      const entry = entries.get(id);
      if (!entry || !['visible', 'paused'].includes(entry.service.state)) {
        return;
      }
      entry.reasons.add(reason);
      if (entry.service.state === 'visible') {
        if (entry.remaining > 0) {
          entry.remaining = Math.max(
            1,
            entry.remaining - (now() - entry.started)
          );
        }
        cancel(entry);
        entry.service.send('pause');
        notify();
      }
    },
    resume(id, reason = 'hover') {
      const entry = entries.get(id);
      if (!entry) {
        return;
      }
      entry.reasons.delete(reason);
      if (entry.service.state === 'paused' && entry.reasons.size === 0) {
        entry.service.send('resume');
        arm(entry);
        notify();
      }
    },
    disconnect() {
      for (const entry of entries.values()) {
        cancel(entry);
        entry.service.stop();
      }
      entries.clear();
    },
  };
}
