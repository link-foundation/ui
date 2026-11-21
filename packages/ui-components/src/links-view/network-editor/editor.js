import * as configurations from '../configurations.js';
import {
  normalize,
  networkUrlOptionKeys,
  toParams,
  fromParams,
  toOptions,
  fromOptions,
} from './options.js';
import { notationPanel, linksPanel, stylePanel } from './panels.js';
import { createNetworkShare } from './share.js';
import { syncNetworkUrl } from './url-sync.js';
import { createNetworkEditorModel, presentationPairs } from './model.js';
import { CSS } from './styles.js';
import { element, button } from './dom.js';
import { editorMessage } from './messages.js';

function stateUrl(state, href, win) {
  const url = new win.URL(href);
  const params = toParams(state.options);
  params.set('code', state.code);
  for (const key of ['code', ...networkUrlOptionKeys, 'index']) {
    const value = params.get(key);
    const previous = url.searchParams.getAll(key);
    if (value === null && previous.length) {
      url.searchParams.delete(key);
    } else if (
      value !== null &&
      (previous.length !== 1 || previous[0] !== value)
    ) {
      url.searchParams.set(key, value);
    }
  }
  return url.href;
}

function panelMounts(root, mounts) {
  const doc = root.ownerDocument;
  const container = element(doc, 'div', undefined, root);
  container.className = 'network-editor';
  element(doc, 'style', CSS, container);
  const roots = [container];
  const mount = (key) => {
    const host = mounts[key];
    if (!host || host === root) {
      return container;
    }
    const wrapper = element(doc, 'div', undefined, host);
    wrapper.className = container.className;
    if (host.getRootNode() !== root.getRootNode()) {
      element(doc, 'style', CSS, wrapper);
    }
    roots.push(wrapper);
    return wrapper;
  };
  return {
    roots,
    notations: mount('notations'),
    links: mount('links'),
    styles: mount('styles'),
    actions: mount('actions'),
  };
}

function editorState(snapshot, config, readOptions) {
  const links = presentationPairs(snapshot);
  return {
    links,
    code: config.encode(links),
    options: normalize(readOptions(snapshot.input.options)),
  };
}

/** DOM adapter panels for a prepared, host-owned network presentation. */
export function createNetworkEditor(root, settings = {}) {
  const {
    presentation,
    configurations: config = configurations,
    solve,
    locale = 'en',
    messages,
    mounts = {},
    share,
    serializeOptions = toOptions,
    readOptions = fromOptions,
    syncUrl = true,
    debug,
  } = settings;
  const doc = root.ownerDocument,
    win = doc.defaultView;
  const { roots, notations, links, styles, actions } = panelMounts(
    root,
    mounts
  );
  const { live, error } = statusNodes(doc, actions);
  const message = editorMessage(messages);
  let disposed = false,
    pending = Promise.resolve();
  const panels = {};
  const announce = (message, failed = false) => {
    (failed ? error : live).textContent = message;
    if (!failed) {
      error.textContent = '';
    }
  };
  const fail = (failure) =>
    announce(message('error', { detail: failure?.message ?? failure }), true);
  const run = (action) => {
    try {
      pending = Promise.resolve(action()).catch((failure) => {
        if (!disposed && failure?.name !== 'AbortError') {
          fail(failure);
        }
      });
    } catch (failure) {
      fail(failure);
      pending = Promise.resolve();
    }
    return pending;
  };
  const model = createNetworkEditorModel(presentation, {
    configurations: config,
    serializeOptions,
    readOptions,
    onChange(external) {
      panels.notations?.refresh(external);
      panels.cards?.refresh();
      panels.styles?.refresh();
      panels.share?.refresh();
    },
    onBusy(busy) {
      for (const panel of roots) {
        panel.setAttribute('aria-busy', String(busy));
      }
      panels.share?.setBusy(busy);
      if (panels.apply) {
        panels.apply.disabled = busy || !solve;
      }
    },
  });
  const getState = model.snapshot;
  const getCommittedState = () =>
    editorState(presentation.snapshot(), config, readOptions);
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
    message,
    fail,
    run,
    draft: null,
    applyLinks: model.applyLinks,
    changeOptions: model.changeOptions,
    applyStyle: model.applyStyle,
    removeLink: model.removeLink,
    canonicalize: model.canonicalize,
  };
  panels.notations = notationPanel(notations, context);
  panels.cards = linksPanel(links, context);
  panels.styles = stylePanel(styles, context);
  panels.apply = solverControls(actions, model, solve, context);
  panels.share = createNetworkShare(actions, {
    presentation,
    getState: getCommittedState,
    getUrl,
    announce,
    message,
    fail,
    share,
    window: win,
  });
  panels.share.setBusy(false);
  const urlSync = syncUrl
    ? syncNetworkUrl(presentation, {
        window: win,
        root: roots,
        debug,
        urlFor: (state, href) =>
          stateUrl(editorState(state, config, readOptions), href, win),
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
      roots.forEach((wrapper) => wrapper.remove());
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

function solverControls(actions, model, solve, context) {
  const { doc, announce, run, message } = context;
  const solverPanel = element(doc, 'fieldset', undefined, actions);
  element(doc, 'legend', message('solver'), solverPanel);
  const apply = button(doc, solverPanel, message('apply'), () =>
    run(async () => {
      announce(message('solving'));
      const result = await model.solve(solve);
      if (result) {
        announce(message('collisions', result));
      }
    })
  );
  apply.disabled = !solve;
  if (!solve) {
    element(doc, 'p', message('solverUnavailable'), solverPanel);
  }
  return apply;
}
