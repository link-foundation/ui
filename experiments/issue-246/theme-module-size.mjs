// Size of the `virtual:site-themes` module the site plugin inlines into the
// client bundle, per theme. Usage: node experiments/issue-246/theme-module-size.mjs
import { listThemes, loadTheme } from '@link-foundation/ui-themes';

const replacer = (_key, value) =>
  value instanceof Map ? { siteMap: [...value] } : value;
const themes = new Map();
const rows = [];
for (const id of listThemes()) {
  const theme = await loadTheme(id);
  themes.set(id, theme);
  rows.push([id, JSON.stringify(theme, replacer).length]);
}
const total = JSON.stringify(themes, replacer).length;
for (const [id, bytes] of rows.sort((a, b) => b[1] - a[1])) {
  console.log(`${(bytes / 1e6).toFixed(2)} MB  ${id}`);
}
console.log(`${(total / 1e6).toFixed(2)} MB  total (${rows.length} themes)`);
