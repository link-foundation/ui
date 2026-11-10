/** Static matrices live in lazy frames so closed examples cost no DOM or script memory. */
import { renderToHTML, escapeHtml } from '@link-foundation/ui-dom';
import { buildMatrix } from './matrix.js';

export function renderGallery(catalog, language) {
  return `<div id="component-gallery">${catalog.map((component) => `<section data-component="${component.kind}"><h2>${escapeHtml(component.title)}</h2>${component.examples.map((example) => `<details><summary>${escapeHtml(example.id)}</summary><pre><code>${escapeHtml(example.text)}</code></pre><a href="../../gallery/${language}/${example.id}.html">${language === 'ru' ? 'Матрица вариантов' : 'View variant matrix'}</a><iframe loading="lazy" title="${escapeHtml(example.id)} · theme × scheme × state" data-src="../../gallery/${language}/${example.id}.html"></iframe></details>`).join('')}</section>`).join('')}</div>`;
}

export function renderMatrix(example, themes, language, stylesheet) {
  const open = language === 'ru' ? 'Открыть в песочнице' : 'Open in playground';
  const matrix = buildMatrix(example, { themes: [...themes.keys()] });
  const cells = matrix
    .map(
      (cell) =>
        `<figure><figcaption>${escapeHtml(`${cell.theme} · ${cell.scheme} · ${cell.state}`)}</figcaption>${renderToHTML(cell.document, { themeRegistry: themes })}<a target="_top" href="../../${language}/playground/#lino=${encodeURIComponent(cell.links)}">${open}</a></figure>`
    )
    .join('');
  return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(example.id)}</title><link rel="stylesheet" href="${escapeHtml(stylesheet)}"></head><body><main class="gallery-matrix">${cells}</main></body></html>`;
}
