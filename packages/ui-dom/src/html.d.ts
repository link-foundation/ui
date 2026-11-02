// The package self-reference resolves to index.d.ts in TypeScript and Deno
// alike (a relative './index.js' resolves to the JavaScript file in Deno).
export { renderToHTML, escapeHtml } from '@link-foundation/ui-dom';
export type { HtmlOptions } from '@link-foundation/ui-dom';
