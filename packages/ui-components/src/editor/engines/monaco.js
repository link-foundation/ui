/** Optional desktop adapter. Host bundlers configure Monaco's worker URLs. */
import { highlightLinoLine } from '../lino-highlight.js';
import { linoStructure } from '../lino-structure.js';

const tokenState = (continuation = '') => ({
  continuation,
  clone() {
    return tokenState(this.continuation);
  },
  equals(other) {
    return other?.continuation === this.continuation;
  },
});

function registerLino(monaco) {
  if (monaco.languages.getLanguages().some((lang) => lang.id === 'lino')) {
    return;
  }
  monaco.languages.register({ id: 'lino' });
  monaco.languages.setTokensProvider('lino', {
    getInitialState: () => tokenState(),
    tokenize(line, state) {
      const result = highlightLinoLine(line, state.continuation);
      return {
        tokens: result.tokens.map((t) => ({
          startIndex: t.from,
          scopes: `${t.type}.lino`,
        })),
        endState: tokenState(result.continuation),
      };
    },
  });
  monaco.languages.setLanguageConfiguration('lino', {
    brackets: [['(', ')']],
    autoClosingPairs: [{ open: '(', close: ')', notIn: ['string', 'comment'] }],
  });
  monaco.languages.registerFoldingRangeProvider('lino', {
    provideFoldingRanges(model) {
      return linoStructure(model.getValue()).folds.map((fold) => ({
        start: model.getPositionAt(fold.from).lineNumber,
        end: model.getPositionAt(fold.to).lineNumber,
      }));
    },
  });
}

function configureTheme(monaco, win) {
  const dark = win.matchMedia('(prefers-color-scheme: dark)');
  for (const [name, base, foreground] of [
    ['light', 'vs', '202124'],
    ['dark', 'vs-dark', 'e8eaed'],
  ]) {
    monaco.editor.defineTheme(`ui-lino-${name}`, {
      base,
      inherit: true,
      colors: {},
      rules: [
        { token: 'paren.lino', foreground },
        { token: 'colon.lino', foreground },
        { token: 'word.lino', foreground },
        { token: 'id.lino', foreground: name === 'dark' ? '82b1ff' : '164ca0' },
        {
          token: 'string.lino',
          foreground: name === 'dark' ? '8cdbb1' : '136b36',
        },
        {
          token: 'comment.lino',
          foreground: name === 'dark' ? 'b9b9c3' : '555563',
        },
      ],
    });
  }
  const update = () =>
    monaco.editor.setTheme(`ui-lino-${dark.matches ? 'dark' : 'light'}`);
  update();
  dark.addEventListener('change', update);
  return () => dark.removeEventListener('change', update);
}

function matchingLinks(editor, monaco) {
  const marks = editor.createDecorationsCollection();
  const update = () => {
    const model = editor.getModel();
    const position = editor.getPosition();
    const at = model && position ? model.getOffsetAt(position) : -1;
    const pair =
      model?.getLanguageId() === 'lino'
        ? linoStructure(model.getValue()).pairs.find(
            (p) =>
              p.from === at ||
              p.from + 1 === at ||
              p.to === at ||
              p.to - 1 === at
          )
        : null;
    marks.set(
      pair
        ? [pair.from, pair.to - 1].map((offset) => {
            const start = model.getPositionAt(offset);
            const end = model.getPositionAt(offset + 1);
            return {
              range: new monaco.Range(
                start.lineNumber,
                start.column,
                end.lineNumber,
                end.column
              ),
              options: { inlineClassName: 'ui-lino-match' },
            };
          })
        : []
    );
  };
  const cursor = editor.onDidChangeCursorPosition(update);
  const content = editor.onDidChangeModelContent(update);
  const model = editor.onDidChangeModel(update);
  return () => {
    cursor.dispose();
    content.dispose();
    model.dispose();
    marks.clear();
  };
}

export async function createMonacoEngine(
  parent,
  {
    label = 'Source editor',
    onChange = () => {},
    loadMonaco = () => import('monaco-editor'),
  } = {}
) {
  const monaco = await loadMonaco();
  registerLino(monaco);
  const disposeTheme = configureTheme(monaco, parent.ownerDocument.defaultView);
  const models = new Map();
  const selections = new Map();
  let current;
  let applying = false;
  const editor = monaco.editor.create(parent, {
    ariaLabel: label,
    automaticLayout: true,
    minimap: { enabled: false },
    fixedOverflowWidgets: true,
    matchBrackets: 'never',
    bracketPairColorization: { enabled: false },
  });
  const disposeMatches = matchingLinks(editor, monaco);
  const listener = editor.onDidChangeModelContent(() => {
    if (!applying) {
      onChange(editor.getValue(), current);
    }
  });
  return {
    setDocument(doc) {
      applying = true;
      try {
        if (current !== doc.id && current !== undefined) {
          selections.set(current, editor.saveViewState());
        }
        if (!models.has(doc.id)) {
          models.set(doc.id, monaco.editor.createModel(doc.text, doc.language));
        }
        const model = models.get(doc.id);
        if (model.getLanguageId() !== doc.language) {
          monaco.editor.setModelLanguage(model, doc.language);
        }
        if (model.getValue() !== doc.text) {
          model.setValue(doc.text);
        }
        if (current !== doc.id) {
          editor.setModel(model);
          editor.restoreViewState(selections.get(doc.id) ?? null);
        }
        current = doc.id;
      } finally {
        applying = false;
      }
    },
    setDiagnostics(diagnostics) {
      const model = editor.getModel();
      if (model) {
        monaco.editor.setModelMarkers(
          model,
          'lino',
          diagnostics.map((d) => ({
            startLineNumber: d.line,
            startColumn: d.column,
            endLineNumber: d.line,
            endColumn: d.column + 1,
            severity:
              d.severity === 'error'
                ? monaco.MarkerSeverity.Error
                : monaco.MarkerSeverity.Warning,
            message: d.message,
          }))
        );
      }
    },
    focus(offset) {
      if (offset !== undefined && editor.getModel()) {
        editor.setPosition(editor.getModel().getPositionAt(offset));
      }
      editor.focus();
    },
    destroy() {
      listener.dispose();
      disposeTheme();
      disposeMatches();
      editor.dispose();
      for (const model of models.values()) {
        model.dispose();
      }
    },
  };
}
