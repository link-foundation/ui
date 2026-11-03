/* global document, window */
import { formatLinks, loadVocabulary } from '@link-foundation/ui-core';
import { mountDocument, defineKind } from '@link-foundation/ui-dom';
import { loadTheme, listThemes } from '@link-foundation/ui-themes';
import { readStyles, compileCss } from '@link-foundation/ui-style';
import { classicThemes } from '../../packages/ui-themes/src/classic/catalog.js';
import {
  frameStyle,
  corners,
  lines,
} from '../../packages/ui-themes/src/classic/frames.js';
import { layoutVocabulary } from '../../packages/ui-components/src/layout/index.js';
import { chatVocabulary } from '../../packages/ui-components/src/chat/index.js';
import {
  controlsVocabulary,
  CONTROL_KIND_SPECS,
} from '../../packages/ui-components/src/controls/index.js';

const base = layoutVocabulary();
const vocabulary = {
  ...base,
  kinds: new Map([
    ...chatVocabulary().kinds,
    ...controlsVocabulary().kinds,
    ...base.kinds,
  ]),
};
const extra = loadVocabulary(`button-group: kind
  property label string
  children any
graph-canvas: kind
  children none`).kinds;
for (const [kind, spec] of extra) {
  vocabulary.kinds.set(kind, spec);
}
for (const [name, spec] of vocabulary.kinds) {
  const properties = new Map(spec.properties);
  for (const key of ['theme', 'scheme', 'contrast', 'motion', 'transparency']) {
    properties.set(key, { type: 'any', multi: false });
  }
  vocabulary.kinds.set(name, { ...spec, properties });
}
for (const kind of ['button-group', 'graph-canvas']) {
  defineKind(kind, {
    tag: `ui-${kind}`,
    create: (el, ctx) => {
      const node = ctx.document.createElement(`ui-${kind}`);
      if (kind === 'button-group') {
        node.setAttribute('role', 'group');
        node.setAttribute(
          'aria-label',
          el.props.get('label')?.[0] ?? 'Controls'
        );
      } else {
        node.textContent = 'Graph canvas · renderer placeholder';
        node.setAttribute('role', 'img');
        node.setAttribute('aria-label', 'Graph canvas placeholder');
      }
      return node;
    },
  });
}
const themes = await Promise.all(
  listThemes()
    .filter((id) => id !== 'base')
    .map(loadTheme)
);
const chrome = await (
  await fetch(
    '../../packages/ui-themes/themes/classic/deepcase/deepcase-0.1.lino'
  )
).text();
const handlers = await (
  await fetch(
    '../../packages/ui-themes/themes/classic/deepcase/handler-windows.lino'
  )
).text();
const families = [
  'deepcase',
  'konard',
  'immortality',
  'formal-ai',
  'meta-sovereign',
];
const title = (id) =>
  ({
    deepcase: 'DeepCase',
    konard: 'Konard',
    immortality: 'Immortality',
    'formal-ai': 'Formal AI',
    'meta-sovereign': 'Meta-sovereign',
  })[id];
const preview = (id) => ({
  id: `preview-${id}`,
  values: [
    'panel',
    ['title', id],
    ['theme', id],
    ['scheme', 'light'],
    ['motion', 'system'],
    {
      id: `body-${id}`,
      values: [
        'stack',
        ['gap', '12px'],
        {
          id: `text-${id}`,
          values: ['text', 'One document. A different look.'],
        },
        {
          id: `button-${id}`,
          values: [
            'button',
            ['label', 'Primary action'],
            ['variant', 'filled'],
          ],
        },
        {
          id: `field-${id}`,
          values: [
            'text-field',
            ['label', 'Search'],
            ['placeholder', 'Search links'],
          ],
        },
        { id: `message-${id}`, values: ['message-bubble', ['record', 'm1']] },
        { id: `reply-${id}`, values: ['message-bubble', ['record', 'm2']] },
        { id: `compose-${id}`, values: ['composer', ['chat', 'c1']] },
      ],
    },
  ],
});
const links = [
  {
    id: 'gallery',
    values: [
      'tab-group',
      ['label', 'Classic theme families'],
      ...families.map((family) => ({
        id: `family-${family}`,
        values: [
          'panel',
          ['title', title(family)],
          ...classicThemes
            .filter((t) => t.family === family)
            .map((t) => preview(t.id)),
        ],
      })),
    ],
  },
];
const diagnostics = [];
const options = {
  themes,
  kinds: CONTROL_KIND_SPECS,
  parseOptions: { vocabulary },
  onDiagnostic: (d) => diagnostics.push(d),
  chat: {
    data: [
      { id: 'c1', kind: 'chat', title: 'Theme review' },
      { id: 'alice', kind: 'participant', name: 'Alice' },
      {
        id: 'm1',
        kind: 'message',
        chat: 'c1',
        sender: 'alice',
        text: 'Every part follows the selected theme.',
        time: '2026-11-03T12:00:00Z',
      },
      {
        id: 'm2',
        kind: 'message',
        chat: 'c1',
        outgoing: true,
        text: 'Ready for review.',
        status: 'delivered',
        time: '2026-11-03T12:01:00Z',
      },
    ],
    clock: () => Date.parse('2026-11-03T12:02:00Z'),
    locale: 'en',
    timeZone: 'UTC',
  },
};
const mounted = mountDocument(
  document.getElementById('gallery'),
  formatLinks(links),
  options
);
document
  .querySelector('[data-link-id="family-deepcase"]')
  .append(document.getElementById('deepcase-demo'));
const deepcase = mountDocument(
  document.getElementById('deepcase'),
  chrome,
  options
);
const windows = mountDocument(document.getElementById('windows'), handlers, {
  ...options,
  layout: { viewport: () => ({ width: 600, height: 360 }) },
});
document.getElementById('open-handler').addEventListener('click', () => {
  windows.store.setProp('handler', 'open', ['true']);
  windows.handle.flush();
});
const axes = mountDocument(
  document.getElementById('axes'),
  formatLinks([
    {
      id: 'axes-skin',
      values: [
        'panel',
        ['title', 'Nested chat and composer axes'],
        ['theme', 'fa-glass'],
        {
          id: 'axes-chat',
          values: [
            'stack',
            ['theme', 'chat-bubbles'],
            {
              id: 'axes-message',
              values: ['message-bubble', ['record', 'm1']],
            },
            {
              id: 'axes-composer',
              values: [
                'composer',
                ['theme', 'composer-glass-soft'],
                ['chat', 'c1'],
              ],
            },
          ],
        },
      ],
    },
  ]),
  options
);
for (const [select, boundary, instance] of [
  ['deepcase-theme', 'classic-chrome', deepcase],
  ['skin', 'axes-skin', axes],
  ['chat-style', 'axes-chat', axes],
  ['composer-style', 'axes-composer', axes],
]) {
  document.getElementById(select).addEventListener('change', (event) => {
    instance.store.setProp(boundary, 'theme', [event.target.value]);
    instance.handle.flush();
  });
}
const frames = document.getElementById('frames');
for (const corner of corners) {
  for (const line of lines) {
    const cell = document.createElement('section');
    cell.dataset.frame = `${corner}-${line}`;
    cell.dataset.theme = 'glass';
    const style = document.createElement('style');
    style.textContent = compileCss(
      readStyles(frameStyle({ corner, line })).rules,
      { scope: `[data-frame="${corner}-${line}"]` }
    );
    const panel = document.createElement('ui-panel');
    panel.textContent = `${corner} / ${line}`;
    cell.append(style, panel);
    frames.append(cell);
  }
}
for (const node of document.querySelectorAll('#gallery > *, #axes > *')) {
  node.classList.add('ui-chat-shell');
}
window.classicGallery = { mounted, deepcase, windows, axes, diagnostics };
document.body.dataset.ready = 'true';
