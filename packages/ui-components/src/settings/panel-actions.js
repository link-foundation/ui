import {
  defaults,
  applyPreset,
  randomize,
  toLino,
  fromLino,
  fromLegacyJson,
  toShareHash,
} from '@link-foundation/ui-settings';

import { presetCards } from './preset-cards.js';

export function createToolbar(context) {
  const {
    node,
    button,
    schema,
    options,
    messages,
    win,
    commit,
    getValues,
    isPeeking,
    setPeek,
  } = context;
  const toolbar = node('div');
  toolbar.className = 'settings-toolbar';
  const presets = node('select', undefined, toolbar);
  messages.attr(presets, 'aria-label', 'preset');
  const custom = node('option', messages.message('custom'), presets);
  custom.value = '';
  for (const preset of schema.presets.values()) {
    const option = node('option', preset.label ?? preset.id, presets);
    option.value = preset.id;
  }
  const cards =
    options.presets?.display === 'cards' ? presetCards(context, toolbar) : null;
  presets.hidden = Boolean(cards);
  presets.addEventListener('change', () => {
    if (presets.value) {
      commit(applyPreset(schema, getValues(), presets.value));
    }
  });
  button(
    messages.message('randomize'),
    () =>
      commit(
        randomize(schema, getValues(), {
          random: options.random ?? Math.random,
          locked: options.randomLocked,
        })
      ),
    toolbar
  );
  button(
    messages.message('resetAll'),
    () => {
      const confirm =
        options.confirmReset ??
        (() => win.confirm(messages.text('confirmReset')));
      if (confirm()) {
        commit(defaults(schema));
      }
    },
    toolbar
  );
  const peek = button(messages.message('peek'), () => {}, toolbar);
  const startPeek = () => {
    if (!isPeeking()) {
      setPeek(true);
    }
  };
  function endPeek() {
    if (isPeeking()) {
      setPeek(false);
    }
  }
  const back = button(messages.message('back'), endPeek, toolbar);
  back.className = 'settings-peek-back';
  back.hidden = true;
  if (options.peek === 'toggle') {
    peek.addEventListener('click', () => setPeek(!isPeeking()));
  } else {
    peek.addEventListener('pointerdown', (event) => {
      peek.setPointerCapture?.(event.pointerId);
      startPeek();
    });
    peek.addEventListener('keydown', (event) => {
      if ([' ', 'Enter'].includes(event.key)) {
        event.preventDefault();
        startPeek();
      }
    });
    peek.addEventListener('keyup', endPeek);
    peek.addEventListener('blur', endPeek);
    peek.addEventListener('lostpointercapture', endPeek);
    win.addEventListener('pointerup', endPeek);
    win.addEventListener('pointercancel', endPeek);
    win.addEventListener('blur', endPeek);
  }
  return {
    presets,
    cards,
    peek,
    updatePeek(value) {
      back.hidden = options.peek !== 'toggle' || !value;
    },
    endPeek,
    destroy() {
      cards?.destroy();
      win.removeEventListener('pointerup', endPeek);
      win.removeEventListener('pointercancel', endPeek);
      win.removeEventListener('blur', endPeek);
    },
  };
}

export function createSharing({
  node,
  button,
  schema,
  options,
  messages,
  win,
  commit,
  getValues,
  isDestroyed,
  importLooks,
}) {
  node('h3', messages.message('changes'));
  const changes = node('textarea');
  changes.rows = 6;
  changes.spellcheck = false;
  messages.attr(changes, 'aria-label', 'changes');
  const status = node('p');
  status.setAttribute('role', 'status');
  const fallback = node('textarea');
  fallback.rows = 6;
  fallback.readOnly = true;
  fallback.hidden = true;
  messages.attr(fallback, 'aria-label', 'copyText');
  async function copy(text) {
    try {
      if (!win.navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await win.navigator.clipboard.writeText(text);
      if (!isDestroyed()) {
        messages.content(status, 'copied');
      }
    } catch {
      if (isDestroyed()) {
        return;
      }
      fallback.hidden = false;
      fallback.value = text;
      fallback.focus();
      fallback.select();
      messages.content(status, 'copyFallback');
    }
  }
  button(messages.message('copyChanges'), () => copy(exportText()));
  const exportText = () =>
    options.codec?.write(getValues()) ?? toLino(schema, getValues());
  const importText = (text) => {
    const collection = importLooks(text);
    if (collection !== null) {
      return collection;
    }
    const parsed = options.codec
      ? options.codec.read(text, { base: getValues() })
      : text.trimStart().startsWith('{')
        ? fromLegacyJson(schema, text, { version: schema.version })
        : fromLino(schema, text);
    if (
      !parsed.ok ||
      parsed.rejected.length ||
      parsed.diagnostics?.some((d) => d.severity === 'error')
    ) {
      messages.content(status, 'invalid');
      return false;
    }
    if (!commit(parsed.values)) {
      return false;
    }
    messages.content(status, 'applied');
    return true;
  };
  button(messages.message('pasteChanges'), () => importText(changes.value));
  const file = node('input');
  file.type = 'file';
  file.hidden = true;
  file.accept = '.lino,.json,text/plain,application/json';
  messages.attr(file, 'aria-label', 'import');
  button(messages.message('import'), () => file.click());
  file.addEventListener('change', async () => {
    const selected = file.files?.[0];
    if (!selected) {
      return;
    }
    try {
      const text = await selected.text();
      if (!isDestroyed()) {
        importText(text);
      }
    } catch {
      if (!isDestroyed()) {
        messages.content(status, 'readError');
      }
    }
    file.value = '';
  });
  button(messages.message('export'), () => {
    const url = win.URL.createObjectURL(
      new win.Blob([exportText()], { type: 'text/plain' })
    );
    const link = node('a');
    link.href = url;
    link.download = options.codec ? 'settings.txt' : 'settings.lino';
    link.click();
    link.remove();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
  });
  button(messages.message('share'), () => {
    try {
      const url = new win.URL(options.shareUrl ?? win.location.href);
      url.hash = toShareHash(schema, getValues());
      void copy(url.href);
    } catch {
      messages.content(status, 'shareError');
    }
  });
  return { changes, status, importText, exportText, copy };
}
