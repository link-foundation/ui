/** Content loading and layout projection; LiNo is always parsed by ui-core. */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse, format, walk } from '@link-foundation/ui-core';
import { createLocalizer, readCatalogs } from '@link-foundation/ui-i18n';
import { listThemes } from '@link-foundation/ui-themes';
import { siteVocabulary } from './src/kinds.js';
import { loadCatalog } from './src/gallery/catalog.js';

export async function readDocument(file) {
  const document = parse(await readFile(file, 'utf8'), {
    vocabulary: siteVocabulary(),
  });
  const errors = document.diagnostics.filter((d) => d.severity === 'error');
  if (errors.length) {
    throw new Error(
      errors
        .map(
          (d) => `${file}:${d.at?.line ?? 1}:${d.at?.column ?? 1}: ${d.message}`
        )
        .join('\n')
    );
  }
  return document;
}

export const property = (node, name) =>
  node.properties.find((p) => p.name === name)?.values[0];
export function setProperty(node, name, value) {
  node.properties = node.properties.filter((p) => p.name !== name);
  node.properties.push({ name, values: [value] });
}

export async function loadPages({ contentDir, layout, languages }) {
  const shell = await readDocument(layout);
  const catalogs = readCatalogs(
    await readFile(
      new globalThis.URL('./src/messages.lino', import.meta.url),
      'utf8'
    )
  );
  const pages = [];
  let reference;
  for (const language of languages) {
    const names = (await readdir(path.join(contentDir, language)))
      .filter((n) => n.endsWith('.lino'))
      .sort();
    if (reference && names.join() !== reference.join()) {
      throw new Error(`${language}: page set differs from ${languages[0]}`);
    }
    reference = names;
    for (const name of names) {
      const file = path.join(contentDir, language, name);
      const content = await readDocument(file);
      const page = name.slice(0, -5);
      if (page === 'playground') {
        const workspace = await readDocument(
          new globalThis.URL(
            './src/playground/playground.lino',
            import.meta.url
          )
        );
        const catalog = await loadCatalog();
        walk(workspace, (node) => {
          if (node.id === 'example-choice' || node.id === 'preview-theme') {
            const choices =
              node.id === 'example-choice'
                ? catalog.flatMap((c) =>
                    c.examples.map((e) => [
                      e.id,
                      `${c.title} · ${e.id.slice(c.kind.length + 1)}`,
                    ])
                  )
                : listThemes().map((id) => [id, id]);
            const template = node.children[0];
            node.children = choices.map(([id, label]) => {
              const option = globalThis.structuredClone(template);
              option.id = `choice-${id}`;
              setProperty(option, 'label', label);
              setProperty(option, 'value', id);
              return option;
            });
          }
        });
        content.roots[0].children.push(...workspace.roots);
      }
      const route = `${language}/${page === 'index' ? '' : `${page}/`}`;
      const document = globalThis.structuredClone(shell);
      const root = document.roots[0];
      setProperty(root, 'locale', language);
      setProperty(
        root,
        'title',
        `${property(content.roots[0], 'title')} · Links UI`
      );
      walk(document, (node) => {
        if (node.id === 'content') {
          node.children = content.roots[0].children;
        }
        if (node.id === 'language') {
          setProperty(node, 'value', language);
        }
        if (node.id === 'theme-choice') {
          const labels = {
            base: 'Base',
            material3: 'Material 3',
            fluent2: 'Fluent 2',
            hig: 'HIG',
            'hig-ios': 'HIG · iOS',
            'hig-macos': 'HIG · macOS',
          };
          const template = node.children[0];
          node.children = listThemes().map((id) => {
            const option = globalThis.structuredClone(template);
            option.id = id;
            setProperty(option, 'label', labels[id] ?? id);
            return option;
          });
        }
        if (node.kind === 'link') {
          const href = property(node, 'href');
          // Local links in both the layout and content are authored
          // relative to the language home.
          if (href && !href.includes(':') && !href.startsWith('#')) {
            setProperty(
              node,
              'href',
              `${page === 'index' ? './' : '../'}${href === './' ? '' : href}`
            );
          }
        }
        if (node.id === 'english' || node.id === 'russian') {
          const lang = node.id === 'english' ? 'en' : 'ru';
          setProperty(
            node,
            'href',
            `${page === 'index' ? '../' : '../../'}${lang}/${page === 'index' ? '' : `${page}/`}`
          );
        }
      });
      const localizer = createLocalizer({
        catalogs,
        locale: language,
        approved: languages,
      });
      const localized = localizer.localizeDocument(document);
      pages.push({
        file,
        language,
        page,
        route,
        title: property(root, 'title'),
        document: localized,
        text: format(localized),
      });
    }
  }
  return pages;
}
