import { formatLinks } from '@link-foundation/ui-core';
import { element, button, field } from './dom.js';
import { editorMessage } from './messages.js';
import {
  networkShareTargets,
  networkShareDestinations,
} from './share-targets.js';
export { networkShareTargets } from './share-targets.js';

export function networkFilename(code, extension) {
  const suffix = `.${extension}`;
  return (
    `links-network-${String(code).replace(/[^\p{L}\p{N}_,;-]/gu, '-')}`.slice(
      0,
      160 - suffix.length
    ) + suffix
  );
}
/** All export actions use the presentation's captured SVG/raster backend. */
export function createNetworkShare(
  parent,
  {
    presentation,
    getState,
    getUrl,
    announce,
    message = editorMessage(),
    fail = (error) =>
      announce(message('error', { detail: error.message }), true),
    share: shareOptions = {},
    window: win = parent.ownerDocument.defaultView,
  }
) {
  const doc = parent.ownerDocument;
  const panel = element(doc, 'fieldset', undefined, parent);
  element(doc, 'legend', message('share'), panel);
  const urlInput = field(doc, panel, message('networkUrl'));
  urlInput.readOnly = true;
  const destinations = shareOptions.destinations ?? networkShareDestinations;
  const links = targetLinks(doc, panel, message, destinations);
  const getTitle = () =>
    shareOptions.title ?? (getState().options.title || message('shareTitle'));
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
        fail(error);
      }
    });
  const report = (task) =>
    Promise.resolve(task).then(() => announce(message('done')), fail);
  const raster = (type) => {
    const options = getState().options;
    return presentation.toRaster(type, {
      width: options.width,
      height: options.height,
      quality: options.quality,
      background: options['background.color'],
    });
  };
  const exportBlob = blobFactory(presentation, getState, win, raster);
  for (const extension of ['svg', 'png', 'jpg', 'webp', 'lino']) {
    exports.push(
      actionButton(message(`download.${extension}`), () => {
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
      })
    );
  }
  exports.push(
    actionButton(message('copyLink'), () =>
      report(win.navigator.clipboard.writeText(getUrl()))
    )
  );
  exports.push(
    actionButton(message('copySvg'), () =>
      report(win.navigator.clipboard.writeText(presentation.toSvg()))
    )
  );
  const copyImage = actionButton(message('copyImage'), () => {
    // Construct the ClipboardItem in this click's synchronous activation stack.
    try {
      const item = new win.ClipboardItem({ 'image/png': raster('image/png') });
      report(win.navigator.clipboard.write([item]));
    } catch (error) {
      fail(error);
    }
  });
  exports.push(copyImage);
  const share = actionButton(message('share'), () =>
    report(webShare(win, prepared, getUrl(), getTitle(), message))
  );
  exports.push(share);
  function refresh() {
    const url = getUrl();
    urlInput.value = url;
    try {
      const targets = networkShareTargets(url, getTitle(), shareOptions);
      for (const [name, href] of Object.entries(targets)) {
        links[name].href = href;
      }
    } catch {
      Object.values(links).forEach((link) => link.removeAttribute('href'));
      fail(new Error(message('invalidMastodonInstance')));
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
            fail(error);
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

function targetLinks(doc, panel, message, destinations) {
  const targets = element(doc, 'nav', undefined, panel);
  targets.setAttribute('aria-label', message('shareTargets'));
  return Object.fromEntries(
    Object.entries(destinations).map(([name, { label }]) => {
      const node = element(
        doc,
        'a',
        message(`target.${name}`, {}, label),
        targets
      );
      node.target = '_blank';
      node.rel = 'noopener noreferrer';
      return [name, node];
    })
  );
}

function webShare(win, prepared, url, title, message) {
  const payload = { title, url };
  if (!win.navigator.share) {
    return (
      win.navigator.clipboard?.writeText(url) ??
      Promise.reject(new Error(message('sharingUnavailable')))
    );
  }
  if (!prepared || !win.navigator.canShare?.({ files: [prepared] })) {
    return win.navigator.share(payload);
  }
  return win.navigator
    .share({ ...payload, files: [prepared] })
    .catch((error) => {
      if (error.name !== 'AbortError') {
        return win.navigator.share(payload);
      }
      throw error;
    });
}
