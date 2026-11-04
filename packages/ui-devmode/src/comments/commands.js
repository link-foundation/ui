import { createDictation } from './voice.js';

/** Form commands share the same validated model as programmatic callers. */
export function commentCommands({
  window,
  view,
  model,
  picking,
  selection,
  select,
  destroy,
  announce,
  isClosed,
}) {
  let inputMethod = 'text';
  let active = false;
  const t = view.t;
  const dictation = createDictation({
    window,
    onText: (text) => {
      view.instruction.value = `${view.instruction.value} ${text}`
        .trim()
        .slice(0, 4000);
      inputMethod = 'voice';
    },
    onStatus: announce,
    onActive: (value) => {
      active = value;
      view.voice.setAttribute('aria-pressed', String(value));
      view.voice.textContent = t(
        value ? 'Stop voice input' : 'Start voice input'
      );
    },
  });
  view.voice.disabled = !dictation.supported;
  if (!dictation.supported) {
    view.voice.title = t(
      'Voice input is unavailable. Type your instruction instead.'
    );
  }
  const commands = {
    pick: () => picking.setMode('pick'),
    lasso: () => picking.setMode('lasso'),
    clear: () => select([]),
    close: destroy,
    voice: () => (active ? dictation.stop() : dictation.start()),
    add() {
      model.add(selection(), view.instruction.value, inputMethod);
      dictation.stop();
      view.instruction.value = '';
      inputMethod = 'text';
    },
    export() {
      view.exchange.value = model.export();
    },
    import() {
      model.import(view.exchange.value);
    },
    async copy() {
      view.exchange.value = model.export();
      try {
        await window.navigator.clipboard.writeText(view.exchange.value);
        if (!isClosed()) {
          announce(t('Copied.'));
        }
      } catch {
        if (isClosed()) {
          return;
        }
        view.exchange.focus();
        view.exchange.select();
        announce(t('Text selected. Copy it with your keyboard.'));
      }
    },
  };
  return { commands, destroy: () => dictation.destroy() };
}
