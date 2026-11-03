import {
  defaults,
  applyPreset,
  randomize,
  toLino,
  fromLino,
  toShareHash,
} from '@link-foundation/ui-settings';

export function createToolbar({
  node,
  button,
  schema,
  options,
  win,
  commit,
  getValues,
  isPeeking,
  setPeek,
}) {
  const toolbar = node('div');
  toolbar.className = 'settings-toolbar';
  const presets = node('select', undefined, toolbar);
  presets.setAttribute('aria-label', 'Preset');
  const custom = node('option', 'Custom', presets);
  custom.value = '';
  for (const preset of schema.presets.values()) {
    const option = node('option', preset.label ?? preset.id, presets);
    option.value = preset.id;
  }
  presets.addEventListener('change', () => {
    if (presets.value) {
      commit(applyPreset(schema, getValues(), presets.value));
    }
  });
  button(
    'Randomize',
    () =>
      commit(
        randomize(schema, getValues(), {
          random: options.random ?? Math.random,
        })
      ),
    toolbar
  );
  button(
    'Reset everything',
    () => {
      const confirm =
        options.confirmReset ??
        (() => win.confirm('Reset every setting to its default?'));
      if (confirm()) {
        commit(defaults(schema));
      }
    },
    toolbar
  );
  const peek = button('Peek defaults', () => {}, toolbar);
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
  return {
    presets,
    peek,
    endPeek,
    destroy() {
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
  win,
  commit,
  getValues,
  isDestroyed,
}) {
  node('h3', 'Your changes');
  const changes = node('textarea');
  changes.rows = 6;
  changes.spellcheck = false;
  changes.setAttribute('aria-label', 'Your changes');
  const status = node('p');
  status.setAttribute('role', 'status');
  const fallback = node('input');
  fallback.readOnly = true;
  fallback.hidden = true;
  fallback.setAttribute('aria-label', 'Copy text');
  async function copy(text) {
    try {
      if (!win.navigator.clipboard?.writeText) {
        throw new Error('Clipboard unavailable');
      }
      await win.navigator.clipboard.writeText(text);
      if (!isDestroyed()) {
        status.textContent = 'Copied';
      }
    } catch {
      if (isDestroyed()) {
        return;
      }
      fallback.hidden = false;
      fallback.value = text;
      fallback.focus();
      fallback.select();
      status.textContent = 'Select and copy this text';
    }
  }
  button('Copy changes', () => copy(toLino(schema, getValues())));
  button('Paste changes', () => {
    const parsed = fromLino(schema, changes.value);
    if (
      !parsed.ok ||
      parsed.rejected.length ||
      parsed.diagnostics.some((d) => d.severity === 'error')
    ) {
      status.textContent = 'Invalid settings. No changes applied.';
      return;
    }
    commit(parsed.values);
    status.textContent = 'Changes applied';
  });
  button('Copy share link', () => {
    try {
      const url = new win.URL(options.shareUrl ?? win.location.href);
      url.hash = toShareHash(schema, getValues());
      void copy(url.href);
    } catch (error) {
      status.textContent = error.message;
    }
  });
  return { changes, status };
}
