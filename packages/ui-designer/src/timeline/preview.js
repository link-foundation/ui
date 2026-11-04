/** Preview never writes into the editing store or its undo history. */
import {
  createPlayer,
  replay,
  parseRecording,
} from '@link-foundation/ui-animation';
import { render } from '@link-foundation/ui-dom';
import { CONTROL_KIND_SPECS } from '@link-foundation/ui-components/controls';
import { logToLino } from '@link-foundation/ui-store';
import { formatLinks, parseLinks } from '@link-foundation/ui-core';
import { cloneStore } from '../sync.js';

export function createPreview(context) {
  let control,
    playback,
    host,
    handle,
    hidden = [];
  const cancel = () => {
    control?.cancel();
    control = null;
    playback?.pause();
    playback = null;
    handle?.destroy();
    handle = null;
    host?.remove();
    host = null;
    hidden.forEach(([node, display]) => {
      node.style.display = display;
    });
    hidden = [];
  };
  const player = (target) => {
    const engine = createPlayer(target, {
      animations: context.session.getText(),
      motion: 'full',
      resolveToken: context.options.resolveToken,
    });
    const play = engine.play;
    engine.play = (...args) => {
      const control = play(...args);
      control.finished.catch(() => {});
      return control;
    };
    return engine;
  };
  return {
    cancel,
    seek(item, ms, recording = false) {
      if (!recording) {
        if (playback) {
          cancel();
        }
        if (!control) {
          control = player(context.handle).play(item.id);
          control.finished.catch(() => {});
          control.pause();
        }
        control.seek(ms);
        return;
      }
      if (!playback) {
        cancel();
        const store = cloneStore(context.store);
        const ids = (id) => [id, ...store.children(id).flatMap(ids)];
        const snapshot = logToLino([
          {
            tx: 1,
            origin: 'recording',
            label: null,
            ops: store.toDocument().roots.map((node, index) => ({
              op: 'insert',
              parentId: null,
              index,
              node,
              ids: ids(store.roots()[index]),
            })),
          },
        ]);
        const raw = parseLinks(context.session.getText()).find(
          (link) => link.id === item.id
        );
        const data = parseRecording(formatLinks([raw]));
        data.snapshot ??= snapshot;
        hidden = [...context.canvas.children].map((node) => [
          node,
          node.style.display,
        ]);
        hidden.forEach(([node]) => {
          node.style.display = 'none';
        });
        host = context.document.createElement('div');
        host.className = 'timeline-preview';
        context.canvas.append(host);
        handle = render(host, store, {
          kinds: CONTROL_KIND_SPECS,
          setTitle: false,
        });
        playback = replay(data, { store, player: player(handle) });
      }
      playback.seek(ms);
      handle.flush();
    },
  };
}
