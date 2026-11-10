import { normalize, editOptions } from './options.js';
import { replaceStyle } from './presets.js';
import { remapOptions, canonicalMap } from './remap.js';

export function presentationPairs(snapshot) {
  const items = snapshot.input.items;
  const result = items.map((item, i) => {
    if (!Array.isArray(item) && String(item.id) !== String(i + 1)) {
      throw new TypeError('Doublet item IDs must be sequential');
    }
    return Array.isArray(item)
      ? [...item]
      : [Number(item.source), Number(item.target)];
  });
  if (
    !result.length ||
    !result.every(
      (pair) =>
        pair.length === 2 &&
        pair.every((v) => Number.isInteger(v) && v >= 0 && v <= result.length)
    )
  ) {
    throw new TypeError(
      'Prepare a presentation with sequential 1-based doublet items before mounting an editor'
    );
  }
  return result;
}

export function createEditorModel(
  presentation,
  { config, serializeOptions, readOptions, onChange, onBusy }
) {
  let state = presentation.snapshot();
  let links = presentationPairs(state),
    options = normalize(readOptions(state.input.options));
  let disposed = false,
    revision = 0,
    solver;
  const snapshot = () => ({
    links: globalThis.structuredClone(links),
    options: normalize(options),
    code: config.encode(links),
  });
  const cancel = () => {
    solver?.abort();
    solver = undefined;
    onBusy(false);
  };
  async function commit(nextLinks, nextOptions) {
    if (disposed) {
      throw new Error('Network editor is disposed');
    }
    cancel();
    const job = ++revision;
    links = globalThis.structuredClone(nextLinks);
    options = normalize(nextOptions);
    onChange(false);
    try {
      return await presentation.update({
        items: links.map(([source, target], i) => ({
          id: String(i + 1),
          source: String(source),
          target: String(target),
        })),
        index: String(config.indexOf(links)),
        options: serializeOptions(options),
      });
    } catch (failure) {
      if (!disposed && job === revision) {
        state = presentation.snapshot();
        links = presentationPairs(state);
        options = normalize(readOptions(state.input.options));
        onChange(true);
      }
      throw failure;
    }
  }
  const applyLinks = (next, patch = {}) =>
    commit(
      next,
      editOptions(
        options,
        { ...patch, frame: null },
        { countChanged: next.length !== links.length }
      )
    );
  const unsubscribe = presentation.subscribe((nextState) => {
    const next = presentationPairs(nextState);
    const externalNetwork = config.encode(next) !== config.encode(links);
    const external =
      externalNetwork || nextState.input.options !== serializeOptions(options);
    if (external) {
      ++revision;
      cancel();
    }
    state = nextState;
    links = next;
    options = normalize(readOptions(state.input.options));
    onChange(externalNetwork);
  });
  return {
    snapshot,
    applyLinks,
    changeOptions: (patch) => commit(links, editOptions(options, patch)),
    applyStyle: (style) => commit(links, replaceStyle(options, style)),
    restore: (next, nextOptions) => commit(next, nextOptions),
    removeLink(k) {
      const result = config.removeLink(links, k);
      return applyLinks(
        result.links,
        remapOptions(options, result.indexMap, result.links.length)
      );
    },
    canonicalize() {
      if (links.length > 7) {
        return;
      }
      const code = config.canonical(links),
        next = config.decode(code);
      return applyLinks(
        next,
        remapOptions(options, canonicalMap(config, links, code), next.length)
      );
    },
    async solve(callback) {
      cancel();
      solver = new globalThis.AbortController();
      const active = solver,
        job = revision;
      onBusy(true);
      try {
        const result = await callback(
          globalThis.structuredClone(links),
          normalize(options),
          { signal: active.signal }
        );
        if (disposed || active.signal.aborted || job !== revision) {
          return null;
        }
        solver = undefined;
        await commit(links, {
          ...options,
          turns: result.turns,
          linkGaps: result.linkGaps,
          frame: result.frame,
        });
        return result;
      } finally {
        if (!disposed && (solver === active || !solver)) {
          solver = undefined;
          onBusy(false);
        }
      }
    },
    dispose() {
      disposed = true;
      ++revision;
      cancel();
      unsubscribe();
    },
  };
}
