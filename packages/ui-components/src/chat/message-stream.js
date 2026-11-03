import { calendarDay, messageRuns } from './chat-model.js';
import { createViewport } from '../data/viewport.js';
import { drawBubble } from './message-bubble.js';
import { drawDay } from './day-separator.js';
import { createFollow, firstUnread } from './follow.js';
import { createChatSelection } from './selection.js';
import { createChatActions } from './actions.js';
import { streamKeydown } from './stream-keys.js';
import {
  atomOf,
  chatOptions,
  chatRecords,
  make,
  registerChatKind,
} from './dom.js';

function listenStream(
  node,
  state,
  stream,
  follow,
  jump,
  { ctx, older, newer, newest }
) {
  let pendingFrame = null;
  const { root, selection, actions, viewport } = state;
  const run = (promise) => promise?.catch(() => {});
  const listeners = [];
  const listen = (target, type, fn) => {
    target.addEventListener(type, fn);
    listeners.push(() => target.removeEventListener(type, fn));
  };
  listen(older, 'click', () => {
    follow.pause();
    run(stream?.loadOlder());
  });
  listen(newer, 'click', () => run(stream?.loadNewer()));
  listen(newest, 'click', () => {
    follow.toBottom();
  });
  listen(node, 'ui-chat-jump', (event) => run(jump(event.detail.id)));
  listen(node, 'ui-chat-open-actions', (event) => {
    const message = state.messages.find((m) => m.id === event.detail.id);
    if (message) {
      actions.open(message, event.detail.anchor);
    }
  });
  listen(root, 'keydown', (event) => streamKeydown(event, state));
  listen(root, 'contextmenu', (event) => {
    const row = event.target.closest('[data-message]');
    const message = state.messages.find((m) => m.id === row?.dataset.message);
    if (message) {
      event.preventDefault();
      row.focus({ preventScroll: true });
      actions.open(message, row, { x: event.clientX, y: event.clientY });
    }
  });
  listen(root, 'click', (event) => {
    const row = event.target.closest('[data-message]');
    if (!row || event.target.closest('button, a, summary, details')) {
      return;
    }
    state.active = row.dataset.message;
    selection.select(state.active, {
      toggle: event.ctrlKey || event.metaKey,
      range: event.shiftKey,
      keys: state.messages.map((m) => m.id),
    });
    viewport.setActive(state.active);
    viewport.render();
    row.focus({ preventScroll: true });
  });
  listen(root, 'scroll', () => {
    if (!state.messages.length || !stream || pendingFrame !== null) {
      return;
    }
    pendingFrame = ctx.document.defaultView.requestAnimationFrame(() => {
      pendingFrame = null;
      const snapshot = stream.state();
      if (snapshot.loading) {
        return;
      }
      if (
        root.scrollTop < stream.prefetch * 30 &&
        !follow.state().following &&
        snapshot.hasOlder
      ) {
        run(stream.loadOlder());
      } else if (
        root.scrollHeight - root.clientHeight - root.scrollTop <
          stream.prefetch * 30 &&
        snapshot.hasNewer
      ) {
        run(stream.loadNewer());
      }
    });
  });
  return () => {
    listeners.forEach((fn) => fn());
    if (pendingFrame !== null) {
      ctx.document.defaultView.cancelAnimationFrame(pendingFrame);
    }
  };
}

function renderStatus(snapshot, root, older, newer, status, options) {
  root.setAttribute('aria-busy', String(snapshot.loading));
  older.disabled = snapshot.loading || !snapshot.hasOlder;
  newer.disabled = snapshot.loading || !snapshot.hasNewer;
  status.textContent =
    snapshot.error?.message ??
    (snapshot.loading
      ? (options.labels?.loading ?? 'Loading')
      : snapshot.messages.length
        ? ''
        : (options.labels?.empty ?? 'No messages'));
}

function sameRowContent(row, message, previous, state) {
  return (
    row._message === message &&
    row._version === state.version &&
    row._previous === previous?.id &&
    row._unread === (state.unread === message.id)
  );
}

function rowDrawer(state, ctx, options) {
  return (row, message, index) => {
    const { selection, runStarts, highlighted, unread, version } = state;
    row.dataset.message = message.id;
    row.classList.toggle('ui-chat-run-continued', !runStarts.has(message.id));
    row.setAttribute('role', 'article');
    row.setAttribute(
      'aria-label',
      `${message.sender ?? ''}: ${message.text ?? ''}`
    );
    row.tabIndex = message.id === state.active ? 0 : -1;
    row.classList.toggle(
      'ui-chat-selected',
      selection.state().selected.has(message.id)
    );
    row.classList.toggle('ui-chat-highlighted', highlighted === message.id);
    const previous = state.messages[index - 1];
    if (sameRowContent(row, message, previous, state)) {
      return;
    }
    const children = [];
    if (
      message.time &&
      (!previous ||
        calendarDay(message.time, options.timeZone) !==
          calendarDay(previous.time, options.timeZone))
    ) {
      const day = make(ctx.document, 'div');
      drawDay(day, message.time, options);
      children.push(day);
    }
    if (unread === message.id) {
      children.push(
        make(
          ctx.document,
          'div',
          {
            class: 'ui-chat-unread',
            role: 'separator',
            'aria-label': options.labels?.unread ?? 'Unread messages',
          },
          options.labels?.unread ?? 'Unread messages'
        )
      );
    }
    const bubble = make(ctx.document, 'div');
    drawBubble(bubble, message, ctx);
    children.push(bubble);
    row.replaceChildren(...children);
    row._message = message;
    row._version = version;
    row._previous = previous?.id;
    row._unread = unread === message.id;
  };
}

function createStream(node, initial, ctx) {
  const options = chatOptions(ctx);
  const stream = options.windows?.[atomOf(initial, 'source')];
  const root = make(ctx.document, 'div', {
    class: 'ui-chat-scroll',
    role: 'region',
    'aria-label': atomOf(initial, 'label') ?? 'Messages',
    tabindex: '0',
  });
  const body = make(ctx.document, 'div', { class: 'ui-chat-body' });
  const status = make(ctx.document, 'div', {
    class: 'ui-chat-status',
    role: 'status',
    'aria-live': 'polite',
  });
  const older = make(
    ctx.document,
    'button',
    { type: 'button' },
    options.labels?.older ?? 'Load older'
  );
  const newer = make(
    ctx.document,
    'button',
    { type: 'button' },
    options.labels?.newer ?? 'Load newer'
  );
  const newest = make(
    ctx.document,
    'button',
    { type: 'button' },
    options.labels?.bottom ?? 'Follow latest'
  );
  const toolbar = make(ctx.document, 'div', { class: 'ui-chat-toolbar' });
  toolbar.append(older, newer, newest);
  root.append(body);
  node.append(toolbar, root, status);
  const selection = createChatSelection();
  const follow = createFollow(root);
  const actions = createChatActions(node, selection, ctx);
  const state = {
    root,
    messages: [],
    active: null,
    selection,
    actions,
    label: root.getAttribute('aria-label'),
  };
  let currentEl = initial;
  state.highlighted = null;
  state.unread = null;
  let initialized = false;
  let disposed = false;
  state.version = 0;
  state.runStarts = new Set();
  const viewport = createViewport(root, body, {
    estimate: 64,
    draw: rowDrawer(state, ctx, options),
    changed: () => follow.refresh(),
  });
  state.viewport = viewport;
  const run = (promise) => promise?.catch(() => {}); // Error is visible in stream state/status.
  const render = (snapshot) => {
    if (disposed) {
      return;
    }
    state.messages = snapshot.messages;
    state.runStarts = new Set(
      messageRuns(state.messages, options).map((r) => r.messages[0].id)
    );
    state.highlighted = snapshot.highlighted;
    state.unread = firstUnread(snapshot.messages);
    if (!state.messages.some((m) => m.id === state.active)) {
      state.active = state.messages.at(-1)?.id ?? null;
    }
    renderStatus(snapshot, root, older, newer, status, options);
    viewport.setActive(state.active);
    viewport.setItems(state.messages);
    if (!initialized && state.messages.length) {
      initialized = true;
      follow.toBottom();
    }
  };
  const jump = async (id) => {
    if (!stream) {
      return;
    }
    follow.pause();
    await stream.jumpTo(id);
    state.active = id;
    viewport.setActive(id);
    viewport.scrollTo(state.messages.findIndex((m) => m.id === id));
    viewport.render();
    viewport.row(id)?.focus({ preventScroll: true });
  };
  const unlisten = listenStream(node, state, stream, follow, jump, {
    ctx,
    older,
    newer,
    newest,
  });
  const unsubscribe = stream?.subscribe(render);
  const unsubscribeData = options.data?.subscribe?.(() => {
    state.version++;
    if (stream) {
      render(stream.state());
    } else {
      refreshStatic();
    }
  });
  const refreshStatic = () =>
    render({
      messages: chatRecords(ctx).filter(
        (r) => r.kind === 'message' && r.chat === atomOf(currentEl, 'chat')
      ),
      highlighted: null,
      loading: false,
      hasOlder: false,
      hasNewer: false,
    });
  return {
    update(el) {
      currentEl = el;
      state.label = atomOf(el, 'label') ?? 'Messages';
      root.setAttribute('aria-label', state.label);
      if (stream) {
        render(stream.state());
        if (!initialized && !stream.state().loading) {
          run(stream.loadOlder());
        }
      } else {
        refreshStatic();
      }
    },
    jumpTo: jump,
    selection,
    disconnect() {
      disposed = true;
      unsubscribe?.();
      unsubscribeData?.();
      unlisten();
      actions.disconnect();
      follow.disconnect();
      viewport.disconnect();
    },
  };
}
registerChatKind('message-stream', createStream);
