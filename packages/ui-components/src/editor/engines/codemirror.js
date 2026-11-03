/** CodeMirror 6 is imported only by the selected adapter. */
import { highlightLino } from '../lino-highlight.js';
import { linoStructure } from '../lino-structure.js';
import { diagnosticOffset } from '../validate-lino.js';

async function languageSupport(name) {
  switch (name) {
    case 'javascript':
      return (await import('@codemirror/lang-javascript')).javascript();
    case 'css':
      return (await import('@codemirror/lang-css')).css();
    case 'json':
      return (await import('@codemirror/lang-json')).json();
    case 'markdown':
      return (await import('@codemirror/lang-markdown')).markdown();
    default:
      return [];
  }
}

/** Shared lexical decorations and parser-confirmed bracket matches. */
function linoDecorations(view, Decoration) {
  const text = view.state.doc.toString();
  const marks = highlightLino(text).map((t) => ({
    from: t.from,
    to: t.to,
    className: `ui-lino-${t.type}`,
  }));
  const cursor = view.state.selection.main.head;
  const structure = linoStructure(text);
  for (const pair of structure.pairs) {
    if ([pair.from, pair.from + 1, pair.to - 1, pair.to].includes(cursor)) {
      for (const at of [pair.from, pair.to - 1]) {
        marks.push({ from: at, to: at + 1, className: 'ui-lino-match' });
      }
    }
  }
  return {
    structure,
    decorations: Decoration.set(
      marks.map((m) =>
        Decoration.mark({ class: m.className }).range(m.from, m.to)
      ),
      true
    ),
  };
}

function syntaxColors(language, tags) {
  return language.syntaxHighlighting(
    language.HighlightStyle.define([
      {
        tag: [tags.keyword, tags.name],
        color: 'var(--color-primary, LinkText)',
      },
      {
        tag: [tags.string, tags.number, tags.bool],
        color: 'var(--color-editor-string, CanvasText)',
      },
      {
        tag: tags.comment,
        color: 'var(--color-on-surface-variant, CanvasText)',
        fontStyle: 'italic',
      },
      { tag: tags.heading, fontWeight: 'bold' },
    ])
  );
}

/** @returns {Promise<import('../editor-engine.js').EditorEngine>} */
export async function createCodeMirrorEngine(
  parent,
  { label = 'Source editor', onChange = () => {} } = {}
) {
  const [state, viewApi, language, commands, lint, { tags }] =
    await Promise.all([
      import('@codemirror/state'),
      import('@codemirror/view'),
      import('@codemirror/language'),
      import('@codemirror/commands'),
      import('@codemirror/lint'),
      import('@lezer/highlight'),
    ]);
  const { EditorState } = state;
  const { EditorView, ViewPlugin, Decoration, keymap } = viewApi;
  const sessions = new Map();
  let current = null;
  let revision = 0;
  let destroyed = false;
  let readOnly = false;
  const access = new state.Compartment();
  const accessExtensions = () => [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
  ];
  const lino = ViewPlugin.fromClass(
    class {
      constructor(view) {
        Object.assign(this, linoDecorations(view, Decoration));
      }
      update(update) {
        if (update.docChanged || update.selectionSet) {
          Object.assign(this, linoDecorations(update.view, Decoration));
        }
      }
    },
    { decorations: (plugin) => plugin.decorations }
  );
  const base = [
    commands.history(),
    keymap.of([
      ...commands.defaultKeymap,
      ...commands.historyKeymap,
      ...language.foldKeymap,
      commands.indentWithTab,
    ]),
    EditorView.contentAttributes.of({ 'aria-label': label, tabindex: '0' }),
    access.of(accessExtensions()),
    EditorView.lineWrapping,
    viewApi.lineNumbers(),
    language.foldGutter(),
    syntaxColors(language, tags),
    EditorView.updateListener.of((update) => {
      if (update.docChanged && current) {
        onChange(update.state.doc.toString(), current.id);
      }
    }),
    EditorView.theme({
      '&': { minHeight: '18rem' },
      '.cm-content': { fontFamily: 'monospace' },
      '.cm-scroller': { overflow: 'auto' },
    }),
  ];
  const view = new EditorView({
    parent,
    state: EditorState.create({ extensions: base }),
  });
  function setReadOnly(enabled) {
    readOnly = enabled;
    if (view.state.facet(EditorState.readOnly) !== enabled) {
      view.dispatch({ effects: access.reconfigure(accessExtensions()) });
    }
  }
  return {
    setReadOnly,
    async setDocument(doc) {
      if (
        current?.id === doc.id &&
        current.language === doc.language &&
        view.state.doc.toString() === doc.text
      ) {
        return;
      }
      const run = ++revision;
      if (current) {
        sessions.set(current.id, {
          state: view.state,
          language: current.language,
        });
      }
      const extension = await languageSupport(doc.language);
      if (destroyed || run !== revision) {
        return;
      }
      const previous = sessions.get(doc.id);
      const restored =
        previous?.language === doc.language &&
        previous.state.doc.toString() === doc.text;
      const extras =
        doc.language === 'lino'
          ? [
              lino,
              language.foldService.of(
                (s, from, to) =>
                  view
                    .plugin(lino)
                    ?.structure.folds.find(
                      (f) => f.from >= from && f.from <= to
                    ) ?? null
              ),
            ]
          : [extension, language.bracketMatching()];
      current = doc;
      view.setState(
        restored
          ? previous.state
          : EditorState.create({ doc: doc.text, extensions: [...base, extras] })
      );
      setReadOnly(readOnly);
    },
    setDiagnostics(diagnostics) {
      const text = view.state.doc.toString();
      view.dispatch(
        lint.setDiagnostics(
          view.state,
          diagnostics.map((d) => {
            const from = diagnosticOffset(text, d);
            return {
              from,
              to: Math.min(text.length, from + 1),
              severity: d.severity,
              message: d.message,
            };
          })
        )
      );
    },
    focus(offset) {
      if (offset !== undefined) {
        view.dispatch({
          selection: { anchor: Math.min(offset, view.state.doc.length) },
          scrollIntoView: true,
        });
      }
      view.focus();
    },
    destroy() {
      destroyed = true;
      revision++;
      sessions.clear();
      view.destroy();
    },
    view,
  };
}
