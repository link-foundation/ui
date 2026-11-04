import { createPreview } from './preview.js';
import { createEditor } from './editor.js';
/** The live preview owns its store, configuration and inspector, isolated in a shadow root. */
import { validateDocument } from './validate.js';
import { decodeShare } from './share.js';
import { copyLink } from './copy.js';

export async function mountPlayground({
  root,
  catalog,
  themes,
  siteStore,
  siteHandle,
}) {
  const document = root.ownerDocument;
  const window = document.defaultView;
  const sourcePane = root.querySelector('ui-playground-editor section');
  const previewPane = root.querySelector('ui-playground-preview section');
  const { editor, numbers, errorBox, status, preview } = createEditor(
    document,
    sourcePane,
    previewPane
  );
  let current;
  let timer;
  let generation = 0;
  let theme = 'base';
  let scheme = 'light';
  const showErrors = (errors) => {
    errorBox.textContent = errors
      .map((e) => `Line ${e.line}, column ${e.column}: ${e.message}`)
      .join('\n');
    editor.setAttribute('aria-invalid', String(errors.length > 0));
    siteStore.setProp('inspect-preview', 'disabled', [
      String(errors.length > 0),
    ]);
    siteHandle.flush();
  };
  const lineNumbers = () => {
    numbers.textContent = editor.value
      .split('\n')
      .map((_, i) => i + 1)
      .join('\n');
  };
  editor.addEventListener('scroll', () => {
    numbers.scrollTop = editor.scrollTop;
  });

  function update() {
    generation++;
    const { tree, errors } = validateDocument(editor.value);
    showErrors(errors);
    lineNumbers();
    if (errors.length) {
      return;
    }
    current?.destroy();
    ({ theme, scheme } = syncChoices(
      tree,
      siteStore,
      siteHandle,
      theme,
      scheme
    ));
    current = createPreview({
      tree,
      preview,
      themes,
      theme,
      scheme,
      editor,
      showErrors,
      lineNumbers,
    });
  }
  const examples = catalog.flatMap((c) => c.examples);
  function load(text) {
    window.clearTimeout(timer);
    editor.value = text;
    update();
  }
  editor.addEventListener('input', () => {
    generation++;
    lineNumbers();
    window.clearTimeout(timer);
    timer = window.setTimeout(update, 150);
  });
  root.addEventListener('ui-change', ({ detail: { source, value } }) => {
    if (source === 'example-choice') {
      const example = examples.find((e) => e.id === value);
      if (example) {
        load(example.text);
      }
    }
    if (source === 'preview-theme' || source === 'preview-scheme') {
      if (source === 'preview-theme') {
        theme = value;
      } else {
        scheme = value;
      }
      const doc = current?.store
        .toDocument()
        .roots.find((node) => node.kind === 'document');
      if (doc) {
        current.config.set(
          'session',
          doc.id,
          source === 'preview-theme' ? 'theme' : 'scheme',
          [value]
        );
      }
    }
  });
  root.addEventListener('click', async (event) => {
    const id = event.target
      .closest('[data-link-id]')
      ?.getAttribute('data-link-id');
    if (
      id === 'inspect-preview' &&
      editor.getAttribute('aria-invalid') !== 'true'
    ) {
      await current?.inspector.open();
    }
    if (id === 'share-preview') {
      const revision = generation;
      const text = editor.value;
      await copyLink({
        window,
        text,
        status,
        isCurrent: () => revision === generation && editor.value === text,
      });
    }
  });
  async function loadHash() {
    const revision = ++generation;
    const hash = window.location.hash;
    const shared = hash ? await decodeShare(hash) : null;
    if (revision !== generation) {
      return;
    }
    if (shared !== null) {
      load(shared);
    } else if (hash) {
      status.textContent = 'Invalid or oversized share link.';
    }
  }
  load(
    examples.find((e) => e.id === 'button-filled')?.text ?? examples[0].text
  );
  await loadHash();
  window.addEventListener('hashchange', loadHash);
}

function syncChoices(tree, siteStore, siteHandle, theme, scheme) {
  const doc = tree.roots.find((node) => node.kind === 'document');
  if (doc) {
    theme = doc.properties.find((p) => p.name === 'theme')?.values[0] ?? theme;
    scheme =
      doc.properties.find((p) => p.name === 'scheme')?.values[0] ?? scheme;
  }
  for (const [id, value] of [
    ['preview-theme', theme],
    ['preview-scheme', scheme],
  ]) {
    siteStore.setProp(id, 'value', [value]);
  }
  siteHandle.flush();
  return { theme, scheme };
}
