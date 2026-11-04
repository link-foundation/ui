/** Documentation semantics shared by static rendering and the live renderer. */
import { defineKind } from '@link-foundation/ui-dom';
import { layoutVocabulary } from '@link-foundation/ui-components/layout';
import { i18nVocabulary } from '@link-foundation/ui-i18n';
import { registerControls } from '@link-foundation/ui-components/controls';

const DOCUMENT_KINDS = {
  heading: ['text', 'level'],
  paragraph: ['text'],
  'code-block': ['text'],
  header: [],
  navigation: [],
  main: [],
  footer: [],
  'playground-editor': [],
  'playground-preview': [],
};

export function siteVocabulary() {
  const base = layoutVocabulary();
  const kinds = new Map(base.kinds);
  for (const [kind, props] of Object.entries(DOCUMENT_KINDS)) {
    kinds.set(kind, {
      positional: [],
      children: 'any',
      properties: new Map(
        props.map((name) => [name, { type: 'string', multi: false }])
      ),
    });
  }
  return i18nVocabulary({ ...base, kinds });
}

const value = (el, name) => el.props.get(name)?.[0] ?? '';

export function registerSiteKinds() {
  registerControls();
  for (const [kind, semantic] of Object.entries({
    heading: 'h1',
    paragraph: 'p',
    'code-block': 'pre',
    header: 'header',
    navigation: 'nav',
    main: 'main',
    footer: 'footer',
    'playground-editor': 'section',
    'playground-preview': 'section',
  })) {
    const text = DOCUMENT_KINDS[kind].includes('text');
    defineKind(kind, {
      tag: `ui-${kind}`,
      childrenSlot: text ? null : (node) => node.firstChild,
      create(el, ctx) {
        const host = ctx.document.createElement(`ui-${kind}`);
        const tag =
          kind === 'heading'
            ? `h${Math.min(6, Math.max(1, Number(value(el, 'level')) || 1))}`
            : semantic;
        const node = ctx.document.createElement(tag);
        if (text) {
          const target =
            kind === 'code-block' ? ctx.document.createElement('code') : node;
          target.appendChild(ctx.document.createTextNode(''));
          if (target !== node) {
            node.appendChild(target);
          }
        }
        host.appendChild(node);
        return host;
      },
      update(node, el) {
        if (text) {
          const target =
            kind === 'code-block'
              ? node.firstChild.firstChild
              : node.firstChild;
          target.firstChild.data = String(value(el, 'text'));
        }
      },
    });
  }
}
