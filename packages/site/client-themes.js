/**
 * The site and shadow-root previews share the precompiled site.css. Their
 * renders use adoptStyles: false, so the browser only needs theme boundaries
 * and control anatomy, not token sets, inheritance chains or style rules.
 * Keep this projection site-local: it cannot be used to compile theme CSS.
 */
export function clientThemes(themes) {
  return new Map(
    [...themes].map(([id, theme]) => [
      id,
      {
        id,
        defaults: theme.defaults,
        templates: theme.templates,
        diagnostics: theme.diagnostics,
        // ui-dom treats themes with sets as already resolved. An empty map
        // preserves that contract without shipping build-time token data.
        sets: new Map(),
      },
    ])
  );
}
