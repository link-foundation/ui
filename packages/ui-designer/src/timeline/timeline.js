/** Docked timeline. Gestures preview freely and commit source once on release. */
import { parseOrThrow } from '@link-foundation/ui-core';
import { createStore } from '@link-foundation/ui-store';
import { render } from '@link-foundation/ui-dom';
import { CONTROL_KIND_SPECS } from '@link-foundation/ui-components/controls';
import { designerVocabulary } from '../catalog.js';
import { element, editable } from '../dom.js';
import { readTimeline } from './model.js';
import { timelineEdit } from './commands.js';
import { timeToX, xToTime, snapTime } from './scale.js';
import { TIMELINE_LAYOUT } from './layout-text.js';
import { createPreview } from './preview.js';
import { timelineProperties } from './properties.js';
import { updateProperties } from '../panels.js';

export function mountTimeline(panel, context) {
  return panel ? new TimelinePanel(panel, context) : null;
}

class TimelinePanel {
  constructor(panel, context) {
    this.panel = panel;
    this.context = context;
    this.document = this.context.document;
    this.window = this.context.window;
    this.session = this.context.session;
    this.controller = this.context.controller;
    this.report = this.context.report;
    this.panel.classList.add('designer-timeline');
    this.store = createStore({
      document: parseOrThrow(TIMELINE_LAYOUT, {
        vocabulary: designerVocabulary(),
      }),
    });
    this.shell = render(this.panel, this.store, {
      kinds: CONTROL_KIND_SPECS,
      setTitle: false,
    });
    this.content = this.shell.nodeFor('timeline-content');
    this.viewport = element(this.document, 'div', {
      class: 'timeline-viewport',
      tabindex: 0,
      role: 'region',
      'aria-label': 'Timeline tracks',
    });
    this.rows = element(this.document, 'div', { class: 'timeline-rows' });
    this.viewport.append(this.rows);
    this.content.append(this.viewport);
    this.preview = createPreview(this.context);
    this.collapsed = new Set();
    this.model = undefined;
    this.active = undefined;
    this.selected = [];
    this.time = 0;
    this.zoom = 0.4;
    this.frame = null;
    this.loop = false;
    this.running = false;
    this.origin = 0;
    this.gesture = null;
    this.toolbar = {
      play: this.play,
      pause: this.pause,
      stop: () => {
        this.pause();
        this.seek(0);
      },
      loop: () => {
        this.loop = !this.loop;
        this.shell
          .nodeFor('timeline-loop')
          .querySelector('button')
          ?.setAttribute('aria-pressed', String(this.loop));
      },
      add: this.add,
      delete: this.remove,
      'zoom-in': () => this.zoomBy(1.25),
      'zoom-out': () => this.zoomBy(0.8),
    };
    for (const [name, fn] of Object.entries(this.toolbar)) {
      this.on(this.shell.nodeFor(`timeline-${name}`), 'click', fn);
    }
    this.on(this.viewport, 'wheel', (event) => {
      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        this.zoomBy(event.deltaY < 0 ? 1.25 : 0.8);
      }
    });
    this.on(this.panel, 'keydown', (event) => {
      if (editable(event.target)) {
        return;
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        return;
      }
      event.stopPropagation();
      if (event.key === 'Escape') {
        this.gesture = null;
        this.update();
        return;
      }
      const handlers = {
        Home: () => this.seek(0),
        End: () => this.seek(this.duration(this.current())),
        ' ': () => (this.running ? this.pause() : this.play()),
        k: this.add,
        K: this.add,
        Delete: this.remove,
        Backspace: this.remove,
        ArrowLeft: () =>
          this.selected.length && event.target.getAttribute('role') !== 'slider'
            ? this.moveSelection(
                (-(event.shiftKey ? 10 : 1) * 1000) / this.fps()
              )
            : this.seek(this.time - 1000 / this.fps()),
        ArrowRight: () =>
          this.selected.length && event.target.getAttribute('role') !== 'slider'
            ? this.moveSelection(
                ((event.shiftKey ? 10 : 1) * 1000) / this.fps()
              )
            : this.seek(this.time + 1000 / this.fps()),
      };
      if (handlers[event.key]) {
        event.preventDefault();
        handlers[event.key]();
      }
    });
    this.on(this.context.canvas, 'focusin', () => {
      if (this.selected.length) {
        this.clearSelection();
        this.context.refresh();
      }
    });
    this.unsubscribe = this.session.subscribe(() => {
      this.pause();
      this.preview.cancel();
      this.update();
    });
    this.update();
  }
  on = (node, type, callback) =>
    node.addEventListener(type, callback, {
      signal: this.rows?.contains(node)
        ? this.drawController.signal
        : this.controller.signal,
    });
  fps = () => this.context.options.timelineFps ?? 60;
  current = () =>
    [...this.model.animations, ...this.model.recordings].find(
      (a) => a.id === this.active
    ) ??
    this.model.animations[0] ??
    this.model.recordings[0];
  isRecording = (item) => !!item?.events;
  duration = (item) =>
    this.isRecording(item)
      ? (item.events.at(-1)?.timeMs ?? 0)
      : (item?.durationMs ?? 0);
  maximum = () =>
    Math.max(
      1000,
      ...this.model.animations.map((a) => a.durationMs),
      ...this.model.recordings.map((r) => this.duration(r))
    );
  state = () => ({ zoom: this.zoom, scroll: this.viewport.scrollLeft });
  timeAt = (event, lane) =>
    Math.max(
      0,
      xToTime(event.clientX - lane.getBoundingClientRect().left, {
        zoom: this.zoom,
        scroll: 0,
      })
    );
  identity = (key) => `${key.id}/${key.track ?? 'event'}/${key.index}`;
  same = (a, b) => this.identity(a) === this.identity(b);
  hasSelection = () => this.selected.length > 0;
  props = () => {
    if (this.selected.length) {
      this.propertySelection = true;
      timelineProperties(
        this.context.shell.nodeFor('properties'),
        this.selected,
        this.current(),
        this.commit,
        this.context.command
      );
    } else if (this.propertySelection) {
      this.propertySelection = false;
      updateProperties(this.context.shell.nodeFor('properties'), this.context);
    }
  };
  pause = () => {
    this.running = false;
    if (this.frame !== null) {
      this.window.cancelAnimationFrame(this.frame);
    }
    this.frame = null;
    this.store.setProp('timeline-play', 'label', ['Play']);
  };
  seek = (ms) => {
    const item = this.current();
    if (!item) {
      return;
    }
    this.time = Math.max(0, Math.min(this.duration(item), ms));
    try {
      this.preview.seek(item, this.time, this.isRecording(item));
    } catch (error) {
      this.report(error.message);
    }
    this.rows.querySelectorAll('.timeline-playhead').forEach((node) => {
      node.style.left = `${timeToX(this.time, { zoom: this.zoom })}px`;
    });
    const ruler = this.rows.querySelector('[role=slider]');
    ruler?.setAttribute('aria-valuenow', String(Math.round(this.time)));
    ruler?.setAttribute('aria-valuemax', String(this.duration(item)));
    ruler?.setAttribute(
      'aria-valuetext',
      `${Math.round(this.time)} milliseconds`
    );
  };
  play = () => {
    if (this.running || !this.current()) {
      return;
    }
    if (this.time >= this.duration(this.current())) {
      this.time = 0;
    }
    this.running = true;
    this.origin = this.window.performance.now() - this.time;
    this.store.setProp('timeline-play', 'label', ['Playing']);
    const tick = (stamp) => {
      const end = this.duration(this.current());
      const elapsed = stamp - this.origin;
      if (elapsed >= end) {
        if (this.loop && end > 0) {
          this.origin = stamp;
          this.seek(0);
        } else {
          this.seek(end);
          this.pause();
          return;
        }
      } else {
        this.seek(elapsed);
      }
      this.frame = this.window.requestAnimationFrame(tick);
    };
    this.frame = this.window.requestAnimationFrame(tick);
  };
  activate = (item) => {
    if (this.active !== item.id) {
      this.pause();
      this.preview.cancel();
      this.active = item.id;
      this.time = 0;
      this.selected = [];
      this.updateSelection();
    }
  };
  commit = (changes) => {
    this.pause();
    try {
      const approved = changes.map((change) => {
        if (change.type === 'duration') {
          const item = this.model.animations.find((a) => a.id === change.id);
          if (
            Array.isArray(item.duration) &&
            !this.window.confirm(
              'Replace the duration token with a literal millisecond value?'
            )
          ) {
            throw new Error('Duration unchanged');
          }
          return { ...change, replaceToken: true };
        }
        return change;
      });
      const text = approved.reduce(timelineEdit, this.session.getText());
      this.retainSelection(text, approved);
      this.preview.cancel();
      const result = this.context.editSource(text);
      if (result.error) {
        throw new Error(result.error.message);
      }
      this.context.options.trace?.('timeline-commit', {
        changes: approved,
        tx: this.context.store.log().at(-1)?.tx,
      });
      this.report('Timeline changes saved');
      this.update();
      this.seek(this.time);
    } catch (error) {
      this.report(error.message);
      this.update();
    }
  };
  retainSelection = (text, changes) => {
    const next = readTimeline(text, this.context.options.resolveToken);
    this.selected = this.selected.flatMap((key) => {
      const edit = changes.find((c) => this.same(c, key));
      if (edit?.type.endsWith('-delete')) {
        return [];
      }
      if (key.recording) {
        return this.retainEventSelection(next, key, edit);
      }
      const before = this.model.animations.find((a) => a.id === key.id)?.tracks[
        key.track
      ]?.keys[key.index];
      const after =
        next.animations.find((a) => a.id === key.id)?.tracks[key.track]?.keys ??
        [];
      const offset =
        edit?.type === 'key-move'
          ? Math.max(0, Math.min(1, edit.offset))
          : before?.offset;
      const index = after.findIndex((k) => Math.abs(k.offset - offset) < 1e-9);
      return index < 0 ? [] : [{ ...key, index }];
    });
  };
  retainEventSelection = (next, key, edit) => {
    const before = this.model.recordings.find((r) => r.id === key.id)?.events[
      key.index
    ];
    const after = next.recordings.find((r) => r.id === key.id)?.events ?? [];
    const stamp =
      edit?.type === 'event-move'
        ? Math.max(0, Math.round(edit.ms))
        : before?.timeMs;
    const index = after.findIndex(
      (e) =>
        e.timeMs === stamp &&
        (edit?.type === 'event-action' ||
          JSON.stringify(e.action) === JSON.stringify(before?.action))
    );
    return index < 0 ? [] : [{ ...key, index }];
  };
  add = () => {
    const item = this.current();
    if (!item) {
      return;
    }
    if (this.isRecording(item)) {
      this.commit([{ id: item.id, type: 'event-insert', ms: this.time }]);
    } else {
      const track = this.selected[0]?.track ?? 0;
      const lane = item.tracks[track];
      if (lane && item.durationMs > 0) {
        this.commit([
          {
            id: item.id,
            track,
            type: 'key-insert',
            offset: this.time / item.durationMs,
            value:
              lane.keys.findLast((k) => k.offset <= this.time / item.durationMs)
                ?.value ?? '1',
          },
        ]);
      }
    }
  };
  remove = () => {
    // Reverse indices keep the remaining selection addresses valid.
    this.commit(
      [...this.selected]
        .sort((a, b) => b.index - a.index)
        .map((key) => ({
          ...key,
          type: key.recording ? 'event-delete' : 'key-delete',
        }))
    );
    this.selected = [];
    this.update();
  };
  clearSelection = () => {
    this.selected = [];
    this.pause();
    this.preview.cancel();
  };
  select = (key, event) => {
    const item = [...this.model.animations, ...this.model.recordings].find(
      (a) => a.id === key.id
    );
    this.activate(item);
    this.selected = event.shiftKey
      ? this.selected.some((k) => this.same(k, key))
        ? this.selected.filter((k) => !this.same(k, key))
        : [...this.selected, key]
      : this.selected.some((k) => this.same(k, key))
        ? this.selected
        : [key];
    this.updateSelection();
  };
  updateSelection = () => {
    this.rows
      .querySelectorAll('[data-marker]')
      .forEach((node) =>
        node.setAttribute(
          'aria-pressed',
          String(
            this.selected.some((k) => this.identity(k) === node.dataset.marker)
          )
        )
      );
    this.props();
  };
  snapped = (ms, item) => {
    const candidates = [
      this.time,
      ...(this.isRecording(item)
        ? item.events.map((e) => e.timeMs)
        : item.tracks.flatMap((t) =>
            t.keys.map((k) => k.offset * item.durationMs)
          )),
    ];
    return snapTime(ms, {
      fps: this.context.options.timelineFps ?? 60,
      candidates,
      threshold: 6 / this.zoom,
    });
  };
  marker = (lane, item, key, ms, label) => {
    const button = element(
      this.document,
      'button',
      {
        type: 'button',
        class: 'timeline-marker',
        'data-marker': this.identity(key),
        'aria-label': label,
        'aria-pressed': this.selected.some((k) => this.same(k, key)),
      },
      key.recording ? '●' : '◆'
    );
    button.style.left = `${timeToX(ms, { zoom: this.zoom })}px`;
    if (ms === 0) {
      button.style.transform = 'none';
    }
    lane.append(button);
    this.on(button, 'click', (event) => {
      if (event.detail === 0) {
        this.select(key, event);
      }
    });
    this.on(button, 'pointerdown', (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      this.select(key, event);
      button.focus();
      this.pause();
      this.gesture = { key, item, lane, start: event.clientX, ms, button };
      button.setPointerCapture(event.pointerId);
    });
    this.on(button, 'pointermove', (event) => {
      if (!this.gesture || this.gesture.button !== button) {
        return;
      }
      const next = this.snapped(
        ms + (event.clientX - this.gesture.start) / this.zoom,
        item
      );
      this.gesture.next = Math.max(
        0,
        key.recording ? next : Math.min(item.durationMs, next)
      );
      button.style.left = `${this.gesture.next * this.zoom}px`;
    });
    this.on(button, 'pointerup', () => {
      if (!this.gesture || this.gesture.button !== button) {
        return;
      }
      const g = this.gesture;
      this.gesture = null;
      if (g.next !== undefined && Math.abs(g.next - ms) > 0.01) {
        this.moveSelection(g.next - ms);
      }
    });
    this.on(button, 'pointercancel', () => {
      this.gesture = null;
      this.update();
    });
    this.on(button, 'lostpointercapture', () => {
      if (this.gesture?.button === button) {
        this.gesture = null;
        this.update();
      }
    });
  };
  moveSelection = (delta) => {
    const item = this.current();
    // Moving right applies the rightmost key first so group moves do not collide.
    const changes = [...this.selected]
      .sort((a, b) => (delta > 0 ? b.index - a.index : a.index - b.index))
      .map((key) =>
        key.recording
          ? {
              ...key,
              type: 'event-move',
              ms: item.events[key.index].timeMs + delta,
            }
          : {
              ...key,
              type: 'key-move',
              offset:
                item.tracks[key.track].keys[key.index].offset +
                delta / item.durationMs,
            }
      );
    this.commit(changes);
  };
  laneRow = (label) => {
    const row = element(this.document, 'div', { class: 'timeline-row' });
    row.append(
      element(this.document, 'span', { class: 'timeline-label' }, label)
    );
    const lane = element(this.document, 'div', { class: 'timeline-lane' });
    row.append(lane);
    this.rows.append(row);
    return lane;
  };
  zoomBy = (factor) => {
    const center = xToTime(this.viewport.clientWidth / 2, this.state());
    this.zoom = Math.max(0.05, Math.min(4, this.zoom * factor));
    this.update();
    this.viewport.scrollLeft = Math.max(
      0,
      timeToX(center, { zoom: this.zoom }) - this.viewport.clientWidth / 2
    );
  };
  animationRow = (item) => {
    const lane = this.laneRow('');
    const toggle = element(
      this.document,
      'button',
      { type: 'button', 'aria-expanded': !this.collapsed.has(item.id) },
      `${item.id} · ${Math.round(item.durationMs)} ms`
    );
    lane.previousSibling.replaceWith(toggle);
    toggle.className = 'timeline-label';
    this.on(toggle, 'click', () => {
      this.activate(item);
      this.collapsed.has(item.id)
        ? this.collapsed.delete(item.id)
        : this.collapsed.add(item.id);
      this.update();
    });
    const end = element(
      this.document,
      'button',
      {
        type: 'button',
        class: 'timeline-end',
        'aria-label': `Duration of ${item.id}`,
        'data-duration': item.id,
      },
      '┃'
    );
    end.style.left = `${item.durationMs * this.zoom}px`;
    lane.append(end);
    let start;
    this.on(end, 'pointerdown', (event) => {
      this.activate(item);
      start = event.clientX;
      end.setPointerCapture(event.pointerId);
    });
    this.on(end, 'pointermove', (event) => {
      if (start !== undefined) {
        end.style.left = `${Math.max(1, item.durationMs + (event.clientX - start) / this.zoom) * this.zoom}px`;
      }
    });
    this.on(end, 'pointerup', (event) => {
      if (start === undefined) {
        return;
      }
      const ms = Math.max(
        1,
        this.snapped(
          item.durationMs + (event.clientX - start) / this.zoom,
          item
        )
      );
      start = undefined;
      this.commit([{ id: item.id, type: 'duration', ms }]);
    });
    this.on(end, 'pointercancel', () => {
      start = undefined;
      this.update();
    });
    this.on(end, 'keydown', (event) => {
      if (['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        this.commit([
          {
            id: item.id,
            type: 'duration',
            ms: Math.max(
              1,
              item.durationMs +
                ((event.key === 'ArrowLeft' ? -1 : 1) *
                  (event.shiftKey ? 10 : 1) *
                  1000) /
                  this.fps()
            ),
          },
        ]);
      }
    });
    if (!this.collapsed.has(item.id)) {
      item.tracks.forEach((track, ti) => {
        const lane = this.laneRow(track.property);
        track.keys.forEach((key, index) =>
          this.marker(
            lane,
            item,
            { id: item.id, track: ti, index },
            key.offset * item.durationMs,
            `${track.property} key at ${Math.round(key.offset * 100)}%, value ${key.value}`
          )
        );
      });
    }
  };
  selectionExists = (key) => {
    const item = [...this.model.animations, ...this.model.recordings].find(
      (item) => item.id === key.id
    );
    return key.recording
      ? !!item?.events?.[key.index]
      : !!item?.tracks?.[key.track]?.keys[key.index];
  };
  update = () => {
    const focused = this.document.activeElement;
    const rulerFocused =
      focused?.getAttribute('role') === 'slider' && this.rows.contains(focused);
    this.drawController?.abort();
    this.drawController = new this.window.AbortController();
    this.model = readTimeline(
      this.context.store,
      this.context.options.resolveToken
    );
    if (!this.current()) {
      this.selected = [];
      this.props();
      this.rows.replaceChildren(
        element(
          this.document,
          'p',
          {},
          'No animations or recordings in this document'
        )
      );
      return;
    }
    this.activate(this.current());
    this.selected = this.selected.filter(this.selectionExists);
    this.rows.replaceChildren();
    this.rows.style.width = `${Math.max(600, this.maximum() * this.zoom + 230)}px`;
    const ruler = this.laneRow('Time (ms)');
    ruler.classList.add('timeline-ruler');
    ruler.setAttribute('role', 'slider');
    ruler.setAttribute('tabindex', '0');
    ruler.setAttribute('aria-label', 'Playhead time');
    ruler.setAttribute('aria-valuemin', '0');
    for (
      let ms = 0;
      ms <= this.maximum();
      ms += Math.max(
        100,
        Math.ceil(80 / this.zoom / 100) * 100,
        Math.ceil(this.maximum() / 200 / 100) * 100
      )
    ) {
      const tick = element(this.document, 'span', {}, String(ms));
      tick.style.left = `${ms * this.zoom}px`;
      ruler.append(tick);
    }
    const scrub = (event) => {
      this.pause();
      this.seek(this.timeAt(event, ruler));
    };
    this.on(ruler, 'pointerdown', (event) => {
      ruler.setPointerCapture(event.pointerId);
      scrub(event);
    });
    this.on(ruler, 'pointermove', (event) => {
      if (ruler.hasPointerCapture(event.pointerId)) {
        scrub(event);
      }
    });
    for (const item of this.model.animations) {
      this.animationRow(item);
    }
    for (const item of this.model.recordings) {
      const lane = this.laneRow(item.id);
      const choose = element(
        this.document,
        'button',
        { type: 'button' },
        item.id
      );
      lane.previousSibling.replaceWith(choose);
      choose.className = 'timeline-label';
      this.on(choose, 'click', () => {
        this.activate(item);
        this.seek(0);
      });
      item.events.forEach((event, index) =>
        this.marker(
          lane,
          item,
          { id: item.id, index, recording: true },
          event.timeMs,
          `${item.id} event at ${event.timeMs} ms: ${event.action.join(' ')}`
        )
      );
    }
    this.rows.querySelectorAll('.timeline-lane').forEach((lane) => {
      const head = element(this.document, 'div', {
        class: 'timeline-playhead',
        'aria-hidden': true,
      });
      head.style.left = `${this.time * this.zoom}px`;
      lane.append(head);
    });
    ruler.setAttribute('aria-valuenow', String(Math.round(this.time)));
    ruler.setAttribute('aria-valuemax', String(this.duration(this.current())));
    this.props();
    this.restoreFocus(focused, rulerFocused);
  };
  restoreFocus = (focused, rulerFocused) => {
    const marker = focused?.dataset?.marker;
    const duration = focused?.dataset?.duration;
    if (marker) {
      [...this.rows.querySelectorAll('[data-marker]')]
        .find((node) => node.dataset.marker === marker)
        ?.focus();
    } else if (duration) {
      [...this.rows.querySelectorAll('[data-duration]')]
        .find((node) => node.dataset.duration === duration)
        ?.focus();
    } else if (rulerFocused) {
      this.rows.querySelector('[role=slider]')?.focus();
    }
  };
  destroy = () => {
    this.drawController?.abort();
    this.pause();
    this.preview.cancel();
    this.unsubscribe();
    this.shell.destroy();
  };
}
