/** Single-document Source panel using the shared, lazy LiNo editor engine. */
import { createEditorEngine } from '@link-foundation/ui-components/editor';
import { element } from './dom.js';

export function mountSourcePanel(
  panel,
  { text, error, onChange, report, readOnly: initialReadOnly = false }
) {
  const host = element(panel.ownerDocument, 'div', {
    class: 'designer-source ui-editor-area',
  });
  panel.append(host, error);
  let value = text;
  let adapter;
  let stopped = false;
  let invalid = false;
  let readOnly = initialReadOnly;
  let diagnostic;
  function attributes() {
    const input = host.querySelector('[role=textbox]');
    input?.setAttribute('aria-describedby', error.id);
    input?.setAttribute(
      'aria-description',
      'Tab indents. Press Escape then Tab to leave Source.'
    );
    input?.setAttribute('aria-invalid', String(invalid));
    input?.setAttribute('aria-readonly', String(readOnly));
  }
  async function display() {
    if (!adapter || stopped) {
      return;
    }
    await adapter.setDocument({
      id: 'document.lino',
      text: value,
      language: 'lino',
    });
    if (!stopped) {
      adapter.setReadOnly(readOnly);
      adapter.setDiagnostics(
        diagnostic ? [{ ...diagnostic, severity: 'error' }] : []
      );
      attributes();
    }
  }
  const ready = createEditorEngine('codemirror', host, {
    label: 'LiNo source',
    onChange: (text) => {
      value = text;
      onChange(text);
    },
  }).then(async (loaded) => {
    if (stopped) {
      loaded.destroy();
      return;
    }
    adapter = loaded;
    await display();
    host.dataset.ready = 'true';
  });
  void ready.catch((failure) => {
    if (!stopped) {
      host.dataset.ready = 'error';
      report(`Unable to load Source editor: ${failure.message}`);
    }
  });
  // Tab indents inside the editor; Escape followed by Tab leaves it.
  let escape = false;
  const keyboard = (event) => {
    if (event.key === 'Tab' && escape) {
      event.stopImmediatePropagation();
      escape = false;
    } else {
      escape = event.key === 'Escape';
    }
  };
  host.addEventListener('keydown', keyboard, true);
  return {
    ready,
    contains: (target) => host.contains(target),
    invalid: () => invalid,
    setText(text) {
      if (value !== text) {
        value = text;
        void display();
      }
    },
    setError(problem) {
      diagnostic = problem;
      invalid = !!problem;
      error.textContent = problem
        ? `Line ${problem.line}, column ${problem.column}: ${problem.message}`
        : '';
      void display();
    },
    setReadOnly(enabled) {
      readOnly = enabled;
      adapter?.setReadOnly(enabled);
      attributes();
    },
    focus() {
      adapter?.focus();
    },
    destroy() {
      stopped = true;
      adapter?.destroy();
      host.removeEventListener('keydown', keyboard, true);
      host.remove();
    },
  };
}
