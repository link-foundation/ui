/** All archive content is DOM supplied by the host, never unsanitized HTML text. */
export function embedView(host) {
  const doc = host.ownerDocument;
  const archive =
    host.querySelector(':scope > [slot="fallback"]') ??
    doc.createElement('div');
  if (!archive.parentNode) {
    archive.append(...host.childNodes);
  }
  archive.setAttribute('slot', 'fallback');
  const live = doc.createElement('div');
  live.dataset.part = 'embed';
  const details = doc.createElement('details');
  const summary = doc.createElement('summary');
  const button = doc.createElement('button');
  button.type = 'button';
  details.append(summary, archive);
  host.append(live, details, button);
  return {
    live,
    archive,
    button,
    show(state, labels, toggle) {
      const fallback = state === 'fallback' || state === 'off';
      live.hidden = fallback;
      if (fallback) {
        details.before(archive);
      } else {
        details.append(archive);
      }
      details.hidden = fallback;
      summary.textContent = labels.archive;
      button.hidden = !toggle;
      button.textContent = fallback ? labels.showEmbed : labels.showArchive;
      button.setAttribute('aria-pressed', String(!fallback));
      host.dataset.state = state;
      host.toggleAttribute('data-loaded', state === 'ready');
    },
    destroy() {
      host.append(archive);
      live.remove();
      details.remove();
      button.remove();
      host.removeAttribute('data-loaded');
      host.removeAttribute('data-state');
    },
  };
}

const english = {
  title: 'Embedded post',
  archive: 'Archived post',
  showEmbed: 'Show embed',
  showArchive: 'Show archive',
};
const russian = {
  title: 'Встроенная публикация',
  archive: 'Архив публикации',
  showEmbed: 'Показать публикацию',
  showArchive: 'Показать архив',
};

function inherited(host, names) {
  for (let node = host; node; node = node.parentElement) {
    for (const name of names) {
      const value = node.getAttribute(name);
      if (value) {
        return value;
      }
    }
  }
}

export function embedContext(host, options, media) {
  const scheme = options.theme ?? inherited(host, ['data-scheme']) ?? 'system';
  const theme =
    scheme === 'system' ? (media?.matches ? 'dark' : 'light') : scheme;
  const locale =
    options.locale ?? inherited(host, ['lang', 'data-locale']) ?? 'en';
  const labels = {
    ...(locale.startsWith('ru') ? russian : english),
    ...options.labels,
  };
  return { theme: theme === 'dark' ? 'dark' : 'light', locale, labels };
}

/** Observe same-origin DOM attributes/size only; never inspect iframe documents. */
export function watchEmbedFrames(container, title, ready) {
  const win = container.ownerDocument.defaultView;
  const frames = new Set();
  const resize = win.ResizeObserver ? new win.ResizeObserver(check) : null;
  function check() {
    for (const frame of container.querySelectorAll('iframe')) {
      if (!frame.getAttribute('title')?.trim()) {
        frame.title = title;
      }
      if (!frames.has(frame)) {
        frames.add(frame);
        resize?.observe(frame);
        frame.addEventListener('load', check);
      }
      if (frame.getBoundingClientRect().height > 0 || frame.offsetHeight > 0) {
        ready();
      }
    }
  }
  const mutations = new win.MutationObserver(check);
  mutations.observe(container, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['height', 'style', 'class', 'title'],
  });
  check();
  return () => {
    mutations.disconnect();
    resize?.disconnect();
    for (const frame of frames) {
      frame.removeEventListener('load', check);
    }
  };
}
