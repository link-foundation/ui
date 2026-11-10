import * as configurations from '../configurations.js';
import {
  normalize,
  toParams,
  fromParams,
  toOptions,
  fromOptions,
} from './options.js';
import { notationPanel, linksPanel, stylePanel } from './panels.js';
import { createNetworkShare } from './share.js';
import { syncNetworkUrl } from './url-sync.js';
import { createEditorModel, presentationPairs } from './model.js';
import { CSS } from './styles.js';
import { element, button } from './dom.js';

function stateUrl(state, href, win) {
  const url = new win.URL(href);
  for (const key of [...Object.keys(normalize({})), 'gap', 'index']) {
    url.searchParams.delete(key);
  }
  url.searchParams.set('code', state.code);
  for (const [key, value] of toParams(state.options)) {
    url.searchParams.set(key, value);
  }
  return url.href;
}

/** DOM adapter panels for a prepared, host-owned network presentation. */
export function createNetworkEditor(root, settings = {}) {
  const {
    presentation,
    configurations: config = configurations,
    solve,
    locale = 'en',
    serializeOptions = toOptions,
    readOptions = fromOptions,
    syncUrl = true,
    debug,
  } = settings;
  const doc = root.ownerDocument,
    win = doc.defaultView;
  const container = element(doc, 'div', undefined, root);
  container.className = 'network-editor';
  element(doc, 'style', CSS, container);
  const { live, error } = statusNodes(doc, container);
  let disposed = false,
    pending = Promise.resolve();
  const panels = {};
  const announce = (message, failed = false) => {
    (failed ? error : live).textContent = message;
    if (!failed) {
      error.textContent = '';
    }
  };
  const run = (action) => {
    try {
      pending = Promise.resolve(action()).catch((failure) => {
        if (!disposed && failure.name !== 'AbortError') {
          announce(failure.message, true);
        }
      });
    } catch (failure) {
      announce(failure.message, true);
      pending = Promise.resolve();
    }
    return pending;
  };
  const model = createEditorModel(presentation, {
    config,
    serializeOptions,
    readOptions,
    onChange(external) {
      panels.notations?.refresh(external);
      panels.cards?.refresh();
      panels.styles?.refresh();
      panels.share?.refresh();
    },
    onBusy(busy) {
      container.setAttribute('aria-busy', String(busy));
      panels.share?.setBusy(busy);
      if (panels.apply) {
        panels.apply.disabled = busy || !solve;
      }
    },
  });
  const getState = model.snapshot;
  const getCommittedState = () => {
    const state = presentation.snapshot();
    const links = presentationPairs(state);
    return {
      links,
      code: config.encode(links),
      options: normalize(readOptions(state.input.options)),
    };
  };
  const getUrl = () => stateUrl(getCommittedState(), win.location.href, win);
  const context = {
    doc,
    win,
    config,
    locale,
    id:
      root.id ||
      `network-editor-${doc.querySelectorAll('.network-editor').length}`,
    getState,
    announce,
    run,
    draft: null,
    applyLinks: model.applyLinks,
    changeOptions: model.changeOptions,
    applyStyle: model.applyStyle,
    removeLink: model.removeLink,
    canonicalize: model.canonicalize,
  };
  panels.notations = notationPanel(container, context);
  panels.cards = linksPanel(container, context);
  panels.styles = stylePanel(container, context);
  panels.apply = solverControls(container, model, solve, announce, run);
  panels.share = createNetworkShare(container, {
    presentation,
    getState: getCommittedState,
    getUrl,
    announce,
    window: win,
  });
  panels.share.setBusy(false);
  const urlSync = syncUrl
    ? syncNetworkUrl(presentation, {
        window: win,
        root: container,
        debug,
        urlFor: (state, href) =>
          stateUrl(
            {
              code: config.encode(presentationPairs(state)),
              options: readOptions(state.input.options),
            },
            href,
            win
          ),
      })
    : null;
  const restoreUrl = () =>
    run(() => {
      const url = new win.URL(win.location.href),
        code = url.searchParams.get('code');
      if (code) {
        return model.restore(config.decode(code), fromParams(url.searchParams));
      }
    });
  win.addEventListener('popstate', restoreUrl);
  panels.notations.refresh(true);
  panels.cards.refresh();
  panels.styles.refresh();
  return {
    get ready() {
      return pending;
    },
    snapshot: getState,
    updateOptions: model.changeOptions,
    updateLinks: model.applyLinks,
    restoreUrl,
    dispose() {
      disposed = true;
      model.dispose();
      urlSync?.dispose();
      panels.share.dispose();
      panels.styles.dispose();
      win.removeEventListener('popstate', restoreUrl);
      container.remove();
    },
  };
}

function statusNodes(doc, container) {
  const live = element(doc, 'p', undefined, container);
  live.setAttribute('role', 'status');
  live.setAttribute('aria-live', 'polite');
  const error = element(doc, 'p', undefined, container);
  error.setAttribute('role', 'alert');
  return { live, error };
}

function solverControls(container, model, solve, announce, run) {
  const doc = container.ownerDocument;
  const solverPanel = element(doc, 'fieldset', undefined, container);
  element(doc, 'legend', 'Solver', solverPanel);
  const apply = button(doc, solverPanel, 'Apply', () =>
    run(async () => {
      announce('Solving…');
      const result = await model.solve(solve);
      if (result) {
        announce(`Collisions ${result.before} → ${result.after}`);
      }
    })
  );
  apply.disabled = !solve;
  if (!solve) {
    element(doc, 'p', 'Solver unavailable.', solverPanel);
  }
  return apply;
}
