/**
 * One stylesheet per render: the base rules of the basic kinds, the token
 * CSS custom properties (ui-tokens `toCss`), the compiled style rules
 * (ui-style `compileCss`) and the `css` option, in that order.
 *
 * The sheet is adopted (`adoptedStyleSheets`) on the root node of the
 * container, a Document or a ShadowRoot; where adoption is not supported
 * one `<style data-ui-dom>` element is used instead. Renders that share a
 * root and the same CSS share one sheet, which is removed when the last of
 * them is destroyed.
 */

import { compileThemeCss } from '@link-foundation/ui-tokens/themes';
import { compileCss, readStyles } from '@link-foundation/ui-style';
import {
  readTokens,
  resolveTokens,
  toCss as tokensCss,
} from '@link-foundation/ui-tokens';

/**
 * Zero-specificity (`:where`) defaults, so every style rule wins over them.
 * The custom elements are light DOM: these are ordinary document rules.
 */
export const BASE_CSS = `:where(ui-document, ui-text, ui-unknown) { display: block; }
:where(ui-stack) { display: flex; flex-direction: column; align-items: flex-start; }
:where(ui-stack[align='start']) { align-items: flex-start; }
:where(ui-stack[align='center']) { align-items: center; }
:where(ui-stack[align='end']) { align-items: flex-end; }
:where(ui-stack[align='stretch']) { align-items: stretch; }
:where(ui-button) { display: inline-flex; border-radius: 20px; }
:where(ui-button) > button { all: unset; box-sizing: border-box; padding: 10px 24px; border-radius: inherit; cursor: pointer; font: inherit; color: inherit; }
:where(ui-button) > button:focus-visible { outline: 3px solid CanvasText; outline-offset: 2px; }
:where(ui-button) > button:disabled { cursor: default; }
:where(ui-button[disabled]) { opacity: 0.38; }
:where(ui-image) { display: inline-block; }
:where(ui-image) > img { display: block; max-width: 100%; height: auto; }
`;

const isMap = (value) => value instanceof Map;

/** The token sets of the `tokens` option: LiNo text or `{ sets }`. */
function tokenSets(tokens, report) {
  if (typeof tokens === 'string') {
    const read = readTokens(tokens);
    read.diagnostics.forEach(report);
    return read.sets;
  }
  return tokens?.sets;
}

/** The CSS custom properties of the theme (empty without tokens). */
function themeCss(options, theme, report) {
  const { tokens, prefix = '' } = options;
  if (tokens === undefined || tokens === null) {
    return '';
  }
  // Already resolved tokens (ui-tokens `resolveTokens`).
  if (isMap(tokens)) {
    return tokensCss(tokens, { selector: ':root, :host', prefix });
  }
  const sets = tokenSets(tokens, report);
  if (!isMap(sets) || sets.size === 0) {
    return '';
  }
  const setId =
    [options.theme, theme].find((id) => sets.has(id)) ?? [...sets.keys()][0];
  const resolved = resolveTokens(sets, setId);
  (resolved.diagnostics ?? []).forEach(report);
  return tokensCss(resolved, { selector: ':root, :host', prefix });
}

/** The CSS of the `styles` option: LiNo text or ui-style rules. */
function rulesCss(options, report) {
  const { styles, prefix = '' } = options;
  if (styles === undefined || styles === null) {
    return '';
  }
  let rules = styles;
  if (typeof styles === 'string') {
    const read = readStyles(styles);
    read.diagnostics.forEach(report);
    rules = read.rules;
  }
  return compileCss(rules, { prefix });
}

/**
 * The CSS text of a render.
 * @param {{tokens?: string|{sets: Map<string, any>}|Map<string, any>,
 *   styles?: string|any[], css?: string, theme?: string, prefix?: string,
 *   baseCss?: boolean}} options
 * @param {string|undefined} theme  the `theme` of the document element
 * @param {(diagnostic: object) => void} report
 */
export function buildCss(options = {}, theme = undefined, report = () => {}) {
  return [
    options.baseCss === false ? '' : BASE_CSS,
    themeCss(options, theme, report),
    ...[...(options.themeRegistry?.values() ?? [])].map((theme) =>
      compileThemeCss(theme, { prefix: options.prefix, onDiagnostic: report })
    ),
    rulesCss(options, report),
    typeof options.css === 'string' ? options.css : '',
  ]
    .filter((part) => part !== '')
    .join('\n');
}

/** root → CSS text → { count, release } */
const shared = new WeakMap();

/** Whether the root can adopt a constructed stylesheet. */
function canAdopt(root, win) {
  return (
    Array.isArray(root.adoptedStyleSheets) &&
    typeof win?.CSSStyleSheet === 'function' &&
    typeof win.CSSStyleSheet.prototype.replaceSync === 'function'
  );
}

function adoptSheet(root, win, css) {
  const sheet = new win.CSSStyleSheet();
  sheet.replaceSync(css);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
  return {
    sheet,
    remove() {
      root.adoptedStyleSheets = root.adoptedStyleSheets.filter(
        (s) => s !== sheet
      );
    },
  };
}

function styleElement(root, container, css) {
  const document = container.ownerDocument;
  const style = document.createElement('style');
  style.setAttribute('data-ui-dom', '');
  style.textContent = css;
  if (root.nodeType === 9) {
    (root.head ?? root.documentElement).appendChild(style);
  } else {
    // A ShadowRoot, or the top of a detached tree.
    root.insertBefore(style, root.firstChild);
  }
  return { element: style, remove: () => style.remove() };
}

/**
 * Apply the CSS to the root node of the container, once per root and CSS.
 * @param {Element} container
 * @param {string} css
 * @returns {{sheet?: CSSStyleSheet, element?: HTMLStyleElement,
 *   release(): void}}
 */
export function adoptStyles(container, css) {
  const root = container.getRootNode();
  const win = container.ownerDocument.defaultView;
  let entries = shared.get(root);
  if (entries === undefined) {
    entries = new Map();
    shared.set(root, entries);
  }
  let entry = entries.get(css);
  if (entry === undefined) {
    const applied = canAdopt(root, win)
      ? adoptSheet(root, win, css)
      : styleElement(root, container, css);
    entry = { ...applied, count: 0 };
    entries.set(css, entry);
  }
  entry.count += 1;
  let released = false;
  return {
    sheet: entry.sheet,
    element: entry.element,
    release() {
      if (released) {
        return;
      }
      released = true;
      entry.count -= 1;
      if (entry.count === 0) {
        entry.remove();
        entries.delete(css);
      }
    },
  };
}
