import { formatLinks } from '@link-foundation/ui-core';
import { element, button, field } from './dom.js';

export function networkFilename(code, extension) {
  const suffix = `.${extension}`;
  return (
    `links-network-${String(code).replace(/[^\p{L}\p{N}_,;-]/gu, '-')}`.slice(
      0,
      160 - suffix.length
    ) + suffix
  );
}
export function networkShareTargets(url, title = 'Links network') {
  const u = encodeURIComponent(url),
    t = encodeURIComponent(title);
  return {
    X: `https://twitter.com/intent/tweet?url=${u}&text=${t}`,
    Telegram: `https://t.me/share/url?url=${u}&text=${t}`,
    VK: `https://vk.com/share.php?url=${u}&title=${t}`,
    Facebook: `https://www.facebook.com/sharer/sharer.php?u=${u}`,
    LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${u}`,
    Reddit: `https://www.reddit.com/submit?url=${u}&title=${t}`,
    Bluesky: `https://bsky.app/intent/compose?text=${t}%20${u}`,
    Mastodon: `https://mastodon.social/share?text=${t}%20${u}`,
    WhatsApp: `https://wa.me/?text=${t}%20${u}`,
    'e-mail': `mailto:?subject=${t}&body=${u}`,
  };
}

/** All export actions use the presentation's captured SVG/raster backend. */
export function createNetworkShare(
  parent,
  {
    presentation,
    getState,
    getUrl,
    announce,
    window: win = parent.ownerDocument.defaultView,
  }
) {
  const doc = parent.ownerDocument;
  const panel = element(doc, 'fieldset', undefined, parent);
  element(doc, 'legend', 'Share', panel);
  const urlInput = field(doc, panel, 'Network URL');
  urlInput.readOnly = true;
  const links = targetLinks(doc, panel);
  let busy = false,
    timer,
    prepared,
    generation = 0,
    disposed = false;
  const exports = [];
  const actionButton = (label, action) =>
    button(doc, panel, label, () => {
      try {
        action();
      } catch (error) {
        announce(error.message, true);
      }
    });
  const report = (task) =>
    Promise.resolve(task).then(
      () => announce('Done'),
      (error) => announce(error.message, true)
    );
  const raster = (type) => {
    const options = getState().options;
    return presentation.toRaster(type, {
      width: options.width,
      height: options.height,
      background: options['background.color'],
    });
  };
  const exportBlob = blobFactory(presentation, getState, win, raster);
  for (const extension of ['svg', 'png', 'jpg', 'webp', 'lino']) {
    exports.push(
      actionButton(
        `Download ${extension === 'jpg' ? 'JPEG' : extension.toUpperCase()}`,
        () => {
          const code = getState().code;
          report(
            exportBlob(extension).then((blob) => {
              const url = win.URL.createObjectURL(blob);
              const anchor = element(doc, 'a', undefined, panel);
              anchor.href = url;
              anchor.download = networkFilename(code, extension);
              anchor.click();
              anchor.remove();
              win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
            })
          );
        }
      )
    );
  }
  exports.push(
    actionButton('Copy link', () =>
      report(win.navigator.clipboard.writeText(getUrl()))
    )
  );
  exports.push(
    actionButton('Copy SVG', () =>
      report(win.navigator.clipboard.writeText(presentation.toSvg()))
    )
  );
  const copyImage = actionButton('Copy image', () => {
    // Construct the ClipboardItem in this click's synchronous activation stack.
    try {
      const item = new win.ClipboardItem({ 'image/png': raster('image/png') });
      report(win.navigator.clipboard.write([item]));
    } catch (error) {
      announce(error.message, true);
    }
  });
  exports.push(copyImage);
  const share = actionButton('Share', () =>
    webShare(win, prepared, getUrl(), report, announce)
  );
  exports.push(share);
  function refresh() {
    const url = getUrl();
    urlInput.value = url;
    for (const [name, href] of Object.entries(networkShareTargets(url))) {
      links[name].href = href;
    }
    prepared = undefined;
    const job = ++generation;
    win.clearTimeout(timer);
    if (busy || disposed) {
      return;
    }
    timer = win.setTimeout(() => {
      const code = getState().code;
      Promise.resolve()
        .then(() => raster('image/png'))
        .then((blob) => {
          if (!disposed && job === generation) {
            prepared = new win.File([blob], networkFilename(code, 'png'), {
              type: 'image/png',
            });
          }
        })
        .catch((error) => {
          if (job === generation) {
            announce(error.message, true);
          }
        });
    }, 200);
  }
  return {
    refresh,
    setBusy(value) {
      busy = value;
      for (const node of exports) {
        node.disabled = busy;
      }
      copyImage.disabled =
        busy || !win.ClipboardItem || !win.navigator.clipboard?.write;
      refresh();
    },
    dispose() {
      disposed = true;
      ++generation;
      win.clearTimeout(timer);
      panel.remove();
    },
  };
}

function blobFactory(presentation, getState, win, raster) {
  return (extension) => {
    if (extension === 'svg') {
      return Promise.resolve(
        new win.Blob([presentation.toSvg()], { type: 'image/svg+xml' })
      );
    }
    if (extension === 'lino') {
      const lines = formatLinks(
        getState().links.map(([s, t], i) => ({
          id: String(i + 1),
          values: [String(s), String(t)],
        }))
      );
      return Promise.resolve(
        new win.Blob([lines], { type: 'text/plain;charset=utf-8' })
      );
    }
    return raster(`image/${extension === 'jpg' ? 'jpeg' : extension}`);
  };
}

function targetLinks(doc, panel) {
  const targets = element(doc, 'nav', undefined, panel);
  targets.setAttribute('aria-label', 'Share targets');
  return Object.fromEntries(
    Object.keys(networkShareTargets('')).map((name) => {
      const node = element(doc, 'a', name, targets);
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
      return [name, node];
    })
  );
}

function webShare(win, prepared, url, report, announce) {
  const payload =
    prepared && win.navigator.canShare?.({ files: [prepared] })
      ? { files: [prepared], title: 'Links network', url }
      : { title: 'Links network', url };
  if (!win.navigator.share) {
    report(
      win.navigator.clipboard?.writeText(url) ??
        Promise.reject(new Error('Sharing unavailable'))
    );
    return;
  }
  try {
    report(
      win.navigator.share(payload).catch((error) => {
        if (payload.files && error.name !== 'AbortError') {
          return win.navigator.share({
            title: 'Links network',
            url,
          });
        }
        throw error;
      })
    );
  } catch (error) {
    announce(error.message, true);
  }
}
