import {
  applySharedLook,
  diff,
  merge,
  fromShareHash,
  looksToLino,
  looksFromLino,
} from '@link-foundation/ui-settings';
import { miniature } from './miniature.js';

/** Named looks are stored as versioned LiNo, with failures visible to the user. */
export function createSavedLooks(context) {
  const {
    schema,
    options,
    messages,
    node,
    button,
    getValues,
    commit,
    win,
    status,
    copy,
  } = context;
  let looks = new Map(Object.entries(options.savedLooks ?? {}));
  const key = options.looksStorageKey ?? 'link-ui.settings.looks.v1';
  const storage = () =>
    options.looksStorage === undefined
      ? win.localStorage
      : options.looksStorage;
  const report = () => messages.content(status, 'looksError');
  looks = loadLooks(schema, storage, key, looks, report);
  const bar = node('div');
  bar.className = 'settings-toolbar';
  const name = node('input', undefined, bar);
  name.maxLength = 60;
  messages.attr(name, 'aria-label', 'lookName');
  const list = node('div');
  list.className = 'settings-cards settings-looks';
  const empty = node('p', messages.message('emptyLooks'));
  let previews = [];
  let beforeName;
  const normalize = (label) =>
    String(label ?? '')
      .trim()
      .slice(0, 60);
  const nextName = () => {
    let n = 1;
    while (looks.has(defaultName(messages, n))) {
      n++;
    }
    return defaultName(messages, n);
  };
  function persist(next) {
    try {
      storage()?.setItem(key, looksToLino(schema, Object.fromEntries(next)));
      options.onLooksChange?.(Object.fromEntries(next));
      looks = next;
      refresh();
      return true;
    } catch {
      report();
      return false;
    }
  }
  function saveLook(label) {
    const key = normalize(label) || nextName();
    return persist(new Map(looks).set(key, diff(schema, getValues())));
  }
  function applyLook(label) {
    return (
      looks.has(label) &&
      commit(applySharedLook(schema, getValues(), looks.get(label)))
    );
  }
  function deleteLook(label) {
    const next = new Map(looks);
    next.delete(label);
    return persist(next);
  }
  function renameLook(label, nextLabel) {
    const key = normalize(nextLabel);
    if (!key || !looks.has(label)) {
      return false;
    }
    const next = new Map(looks);
    const value = next.get(label);
    next.delete(label);
    next.set(key, value);
    return persist(next);
  }
  function refresh() {
    previews.forEach((p) => p.destroy());
    previews = [];
    messages.release(list);
    list.replaceChildren();
    empty.hidden = looks.size > 0;
    for (const [label, values] of looks) {
      previews.push(
        lookCard(context, list, label, values, {
          applyLook,
          saveLook,
          renameLook,
          deleteLook,
        })
      );
    }
  }
  button(messages.message('saveLook'), () => saveLook(name.value), bar);
  button(messages.message('copyLooks'), () => copy(exportLooks()), bar);
  function restoreBeforeLink() {
    return applyLook(beforeName ?? messages.text('beforeLink'));
  }
  function applyShared(hash) {
    const result = fromShareHash(schema, hash, getValues());
    if (result.ok) {
      const label = normalize(messages.text('beforeLink'));
      const previous = new Map(looks);
      if (!saveLook(label)) {
        return { ...result, ok: false };
      }
      if (!commit(result.values)) {
        persist(previous);
        return { ...result, ok: false };
      }
      beforeName = label;
      win.history.replaceState(
        win.history.state,
        '',
        `${win.location.pathname}${win.location.search}`
      );
    }
    return result;
  }
  const exportLooks = () => looksToLino(schema, Object.fromEntries(looks));
  function importLooks(text) {
    const parsed = looksFromLino(schema, text);
    if (!parsed) {
      return null;
    }
    if (!parsed.ok) {
      messages.content(status, 'invalid');
      return false;
    }
    return persist(new Map([...looks, ...Object.entries(parsed.looks)]));
  }
  refresh();
  return {
    saveLook,
    applyLook,
    deleteLook,
    renameLook,
    applyShared,
    restoreBeforeLink,
    exportLooks,
    importLooks,
    destroyLooks: () => previews.forEach((p) => p.destroy()),
  };
}

function lookCard(context, list, label, values, actions) {
  const { node, button, schema, messages } = context;
  const { applyLook, saveLook, renameLook, deleteLook } = actions;
  const card = node('div', undefined, list);
  const title = node('strong', label, card);
  const preview = miniature(context, card, values, { look: label });
  preview.update(merge(schema, undefined, values).values);

  button(messages.message('applyLook'), () => applyLook(label), card);
  button(messages.message('updateLook'), () => saveLook(label), card);
  const input = node('input', undefined, card);
  input.value = label;
  input.maxLength = 60;
  input.hidden = true;
  messages.attr(input, 'aria-label', 'lookName');
  const rename = button(
    messages.message('renameLook'),
    () => {
      input.hidden = false;
      title.hidden = true;
      input.focus();
      input.select();
    },
    card
  );
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      if (renameLook(label, input.value)) {
        list.querySelector('button')?.focus();
      }
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      input.value = label;
      input.hidden = true;
      title.hidden = false;
      rename.focus();
    }
  });
  button(messages.message('deleteLook'), () => deleteLook(label), card);
  return preview;
}

function loadLooks(schema, storage, key, looks, report) {
  try {
    const text = storage()?.getItem(key);
    if (text) {
      const parsed = looksFromLino(schema, text);
      if (parsed?.ok) {
        return new Map([...Object.entries(parsed.looks), ...looks]);
      }
      report();
    }
  } catch {
    report();
  }
  return looks;
}

function defaultName(messages, count) {
  const text = messages.text('defaultLook', { count }).trim();
  const suffix = ` ${count}`;
  return text.length <= 60
    ? text
    : `${text.slice(0, 60 - suffix.length)}${suffix}`;
}
