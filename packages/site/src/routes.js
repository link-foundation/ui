/** Encode authored document values as individual URL path segments. */
export function languageHref(page, language) {
  const prefix = page === 'index' ? '../' : '../../';
  return `${prefix}${encodeURIComponent(language)}/${page === 'index' ? '' : `${encodeURIComponent(page)}/`}`;
}
