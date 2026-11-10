import { getEmbedProvider, isEmbedUrl } from './registry.js';
import { acquireEmbedScript } from './script.js';
import { embedView, embedContext, watchEmbedFrames } from './view.js';

const duration = (value, fallback) =>
  Number.isFinite(Number(value)) && Number(value) > 0
    ? Number(value)
    : fallback;

/** One disposable generation. All continuations retain only this container. */
function renderGeneration(host, view, options, context, transition) {
  const win = host.ownerDocument.defaultView;
  const container = host.ownerDocument.createElement('div');
  view.live.append(container);
  const abort = new win.AbortController();
  let timer = null,
    stopFrames = () => {},
    release = () => {},
    cleanup = () => {};
  let finished = false;
  const dispose = () => {
    abort.abort();
    win.clearTimeout(timer);
    stopFrames();
    release();
    cleanup();
    cleanup = () => {};
    container.remove();
  };
  const fail = (reason) => {
    if (abort.signal.aborted) {
      return;
    }
    finished = true;
    dispose();
    transition('fallback', reason);
    host.dispatchEvent(
      new win.CustomEvent('ui-embed-error', {
        bubbles: true,
        composed: true,
        detail: Object.freeze({
          provider: options.provider,
          id: options.id,
          reason,
        }),
      })
    );
  };
  const ready = () => {
    if (!abort.signal.aborted && !finished) {
      finished = true;
      win.clearTimeout(timer);
      transition('ready');
    }
  };
  const provider = getEmbedProvider(options.provider);
  const post = { id: options.id ?? '', hash: options.hash ?? '' };
  let url;
  try {
    if (!provider || provider.validate(post) !== true) {
      fail('invalid-provider-or-id');
      return dispose;
    }
    url = provider.url(post, context);
    if (!isEmbedUrl(url)) {
      throw new TypeError('Unsafe embed URL');
    }
  } catch {
    fail('invalid-provider-or-id');
    return dispose;
  }
  transition('loading');
  timer = win.setTimeout(
    () => fail('timeout'),
    duration(options.timeout, 12000)
  );
  stopFrames = watchEmbedFrames(container, context.labels.title, ready);
  const request =
    provider.script === null
      ? { promise: Promise.resolve(), release: () => {} }
      : acquireEmbedScript(host.ownerDocument, provider.script, {
          timeout: duration(options.scriptTimeout, 10000),
        });
  release = request.release;
  request.promise
    .then(() => {
      if (abort.signal.aborted) {
        return;
      }
      return provider.render(container, {
        ...post,
        ...context,
        url,
        window: win,
        signal: abort.signal,
        ready,
        unavailable: () => fail('unavailable'),
      });
    })
    .then((result) => {
      const stop = typeof result === 'function' ? result : () => {};
      if (abort.signal.aborted) {
        stop();
      } else {
        cleanup = stop;
      }
    })
    .catch(() => fail('provider-error'));
  return dispose;
}

function validPost(options) {
  try {
    return (
      getEmbedProvider(options.provider)?.validate({
        id: options.id ?? '',
        hash: options.hash ?? '',
      }) === true
    );
  } catch {
    return false;
  }
}

/** Mount on a connected host. destroy() releases all instance-owned resources. */
export function createEmbed(host, initial = {}) {
  const win = host.ownerDocument.defaultView;
  const view = embedView(host);
  const media = win.matchMedia?.('(prefers-color-scheme: dark)');
  let options = { ...initial },
    context,
    current,
    state = 'deferred',
    near = false,
    dead = false;
  let intersection;
  const transition = (next, reason) => {
    state = next;
    view.show(state, context.labels, options.toggle === true);
    if (options.debug) {
      (options.log ?? win.console.debug.bind(win.console))('[ui-embed]', {
        state,
        reason,
        provider: options.provider,
        id: options.id,
      });
    }
  };
  const refresh = () => {
    const previous = current;
    current = undefined;
    context = embedContext(host, options, media);
    if (options.enabled === false) {
      transition('off');
    } else if (near || !validPost(options)) {
      current = renderGeneration(host, view, options, context, transition);
    } else {
      transition('deferred');
    }
    previous?.();
  };
  const onContext = () => {
    const next = embedContext(host, options, media);
    if (next.theme !== context.theme || next.locale !== context.locale) {
      refresh();
    }
  };
  const observer = new win.MutationObserver(onContext);
  // Watch attributes only: provider DOM mutations never restart a widget.
  observer.observe(host.getRootNode(), {
    subtree: true,
    attributes: true,
    attributeFilter: ['data-scheme', 'lang', 'data-locale'],
  });
  media?.addEventListener('change', onContext);
  const onToggle = () => {
    options.enabled = state === 'fallback' || state === 'off';
    refresh();
  };
  view.button.addEventListener('click', onToggle);
  if (win.IntersectionObserver) {
    intersection = new win.IntersectionObserver(
      (entries) => {
        if (!dead && !near && entries.some((entry) => entry.isIntersecting)) {
          near = true;
          intersection.disconnect();
          refresh();
        }
      },
      { rootMargin: options.rootMargin ?? '400px' }
    );
    intersection.observe(host);
  } else {
    near = true;
  }
  refresh();
  return {
    update(patch) {
      if (!dead) {
        options = { ...options, ...patch };
        refresh();
      }
    },
    retry() {
      if (!dead) {
        options.enabled = true;
        refresh();
      }
    },
    destroy() {
      if (dead) {
        return;
      }
      dead = true;
      current?.();
      intersection?.disconnect();
      observer.disconnect();
      media?.removeEventListener('change', onContext);
      view.button.removeEventListener('click', onToggle);
      view.destroy();
    },
  };
}
