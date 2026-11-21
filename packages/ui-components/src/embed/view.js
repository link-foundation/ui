/** All archive content is DOM supplied by the host, never unsanitized HTML text. */
export function embedView(host, externalArchive) {
  const doc = host.ownerDocument;
  if (externalArchive?.contains(host)) {
    throw new TypeError('The embed host must be outside its archive');
  }
  const archive =
    externalArchive ??
    host.querySelector(':scope > [slot="fallback"]') ??
    doc.createElement('div');
  const originalHidden = archive.getAttribute('hidden');
  const live = doc.createElement('div');
  live.dataset.part = 'embed';
  live.tabIndex = -1;
  live.setAttribute('role', 'group');
  const details = externalArchive ? null : doc.createElement('details');
  const summary = details && doc.createElement('summary');
  const button = doc.createElement('button');
  button.type = 'button';
  if (details) {
    if (!archive.parentNode) {
      archive.append(...host.childNodes);
    }
    archive.setAttribute('slot', 'fallback');
    details.append(summary, archive);
    host.append(live, details, button);
  } else {
    host.prepend(live);
  }
  const activeElement = () =>
    host.getRootNode().activeElement ?? doc.activeElement;
  let addedTabIndex = false;
  function focusArchive() {
    if (!archive.hasAttribute('tabindex')) {
      archive.tabIndex = -1;
      addedTabIndex = true;
    }
    archive.focus({ preventScroll: true });
  }
  function showArchive(fallback, label, archiveFocused) {
    if (!details) {
      archive.hidden = !fallback;
      return;
    }
    if (fallback && archive.parentNode === details) {
      details.before(archive);
    } else if (!fallback && archive.parentNode !== details) {
      if (archiveFocused) {
        details.open = true;
      }
      details.append(archive);
    }
    details.hidden = fallback;
    summary.textContent = label;
  }
  function preserveFocus(active, fallback, toggle, archiveFocused) {
    if (fallback && (live.contains(active) || active === summary)) {
      if (toggle) {
        button.focus({ preventScroll: true });
      } else {
        focusArchive();
      }
    } else if (!fallback && externalArchive && archiveFocused) {
      live.focus({ preventScroll: true });
    } else if (details && archiveFocused && activeElement() !== active) {
      active.focus({ preventScroll: true });
    } else if (!toggle && active === button) {
      if (fallback) {
        focusArchive();
      } else {
        live.focus({ preventScroll: true });
      }
    }
  }
  return {
    live,
    button,
    activeElement,
    show(state, labels, toggle, active = activeElement()) {
      const fallback = state === 'fallback' || state === 'off';
      const archiveFocused = archive.contains(active);
      if (toggle && !button.parentNode) {
        host.append(button);
      }
      showArchive(fallback, labels.archive, archiveFocused);
      button.hidden = !toggle;
      button.textContent = fallback ? labels.showEmbed : labels.showArchive;
      button.setAttribute('aria-pressed', String(!fallback));
      live.hidden = fallback;
      live.setAttribute('aria-label', labels.title);
      host.dataset.state = state;
      host.toggleAttribute('data-loaded', state === 'ready');
      preserveFocus(active, fallback, toggle, archiveFocused);
      if (externalArchive && !toggle) {
        button.remove();
      }
    },
    destroy() {
      if (details) {
        host.append(archive);
        details.remove();
      } else if (originalHidden === null) {
        archive.removeAttribute('hidden');
      } else {
        archive.setAttribute('hidden', originalHidden);
      }
      if (addedTabIndex && archive.getAttribute('tabindex') === '-1') {
        archive.removeAttribute('tabindex');
      }
      live.remove();
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
  const resize =
    ready && win.ResizeObserver ? new win.ResizeObserver(check) : null;
  function check() {
    for (const frame of container.querySelectorAll('iframe')) {
      if (!frame.getAttribute('title')?.trim()) {
        frame.title = title;
      }
      if (!ready) {
        continue;
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
