/**
 * The stylesheet of the inspector shadow root. Colours meet WCAG 2.2 AA in
 * light and dark schemes; nothing animates when the user prefers reduced
 * motion.
 */
export const INSPECTOR_CSS = `
:host {
  all: initial;
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 2147483647;
  width: var(--devmode-width, 420px); max-width: 100vw;
  display: flex;
  color-scheme: light dark;
  --bg: #ffffff; --fg: #1d1b20; --muted: #49454f; --line: #c4c7c5;
  --accent: #1a56db; --accent-fg: #ffffff; --soft: #eef2fb;
  --changed: #fff3e0; --changed-line: #8a4b00; --error: #b3261e;
  font: 13px/1.45 system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--fg); background: var(--bg);
  box-shadow: -2px 0 8px rgb(0 0 0 / 0.2);
}
@media (prefers-color-scheme: dark) {
  :host {
    --bg: #1d1b20; --fg: #e6e1e5; --muted: #cac4d0; --line: #49454f;
    --accent: #a8c7fa; --accent-fg: #062e6f; --soft: #2b2930;
    --changed: #3a2a12; --changed-line: #ffb870; --error: #f2b8b5;
  }
}
* { box-sizing: border-box; }
[hidden] { display: none !important; }
.splitter { flex: none; width: 6px; cursor: col-resize;
  background: var(--line); }
.splitter:hover, .splitter:focus-visible { background: var(--accent); }
.frame { flex: 1; min-width: 0; overflow: auto; }
ui-devmode-panel { display: flex; flex-direction: column; min-height: 100%;
  padding: 8px 12px; gap: 8px; }
ui-devmode-heading { display: block; font-size: 15px; font-weight: 700; }
ui-devmode-toolbar { display: flex; flex-wrap: wrap; gap: 6px; }
ui-devmode-status { display: block; color: var(--muted); min-height: 1.45em; }
ui-devmode-status[data-role="selection"] { color: var(--fg); font-weight: 600; }
ui-devmode-tabs { display: flex; flex-direction: column; gap: 6px; flex: 1; }
button, select, input { font: inherit; color: inherit; }
button { border: 1px solid var(--line); background: var(--soft);
  border-radius: 6px; padding: 3px 10px; cursor: pointer; min-height: 28px; }
button:disabled { cursor: default; opacity: 0.65; }
button[aria-pressed="true"] { background: var(--accent);
  color: var(--accent-fg); border-color: var(--accent); }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 1px; }
[role="tablist"] { display: flex; flex-wrap: wrap; gap: 2px;
  border-bottom: 1px solid var(--line); }
[role="tab"] { border: 0; border-radius: 6px 6px 0 0; background: none;
  border-bottom: 3px solid transparent; padding: 4px 8px; }
[role="tab"][aria-selected="true"] { border-bottom-color: var(--accent);
  font-weight: 700; }
ui-devmode-tab { display: block; padding: 2px; }
ul[role="tree"], ul[role="group"] { list-style: none; margin: 0;
  padding: 0; }
ul[role="group"] { padding-left: 16px; }
[role="treeitem"] > .row { display: flex; gap: 6px; align-items: baseline;
  padding: 2px 6px; border-radius: 4px; cursor: pointer; }
[role="treeitem"][aria-selected="true"] > .row { background: var(--accent);
  color: var(--accent-fg); }
[role="treeitem"]:focus { outline: none; }
[role="treeitem"]:focus-visible > .row { outline: 2px solid var(--accent);
  outline-offset: -2px; }
.toggle { width: 1em; display: inline-block; text-align: center; }
.kind { opacity: 0.85; font-style: italic; }
table { width: 100%; border-collapse: collapse; }
caption { text-align: left; font-weight: 700; padding: 4px 0; }
th, td { text-align: left; vertical-align: middle; padding: 3px 4px;
  border-bottom: 1px solid var(--line); }
thead th { font-size: 12px; color: var(--muted); }
tr.is-changed { background: var(--changed);
  box-shadow: inset 3px 0 0 var(--changed-line); }
tr.is-locked th, tr.is-locked .resolved { color: var(--muted); }
td.resolved { font-family: ui-monospace, monospace; word-break: break-word; }
.layer { font-size: 12px; padding: 0 6px; border-radius: 8px;
  border: 1px solid var(--line); white-space: nowrap; }
tr.is-changed .layer { border-color: var(--changed-line); font-weight: 700; }
.editor { display: flex; gap: 4px; align-items: center; }
.editor input[type="text"], .editor input[type="number"], .editor select {
  width: 100%; min-width: 0; padding: 2px 4px; border-radius: 4px;
  border: 1px solid var(--muted); background: var(--bg); }
.editor input[type="number"] { width: 6em; }
.editor input[type="checkbox"] { width: 24px; height: 24px; margin: 0;
  accent-color: var(--accent); }
.editor input[type="color"] { width: 3em; height: 26px; padding: 0;
  border: 1px solid var(--muted); background: var(--bg); }
[aria-invalid="true"] { border-color: var(--error) !important;
  outline: 1px solid var(--error); }
.swatch { display: inline-block; width: 1em; height: 1em;
  vertical-align: -2px; border: 1px solid var(--muted); margin-right: 4px; }
.note { color: var(--muted); margin: 4px 0; }
dl { margin: 4px 0 10px; display: grid; grid-template-columns: auto 1fr;
  gap: 2px 10px; }
dt { font-weight: 600; }
dd { margin: 0; font-family: ui-monospace, monospace; }
h3 { font-size: 13px; margin: 8px 0 2px; }
pre { margin: 0; padding: 8px; background: var(--soft); border-radius: 6px;
  white-space: pre-wrap; font: 12px/1.5 ui-monospace, monospace; }
@media (prefers-reduced-motion: no-preference) {
  button, [role="tab"] { transition: background-color 120ms ease-out; }
}
@media (forced-colors: active) {
  [role="treeitem"][aria-selected="true"] > .row { outline: 2px solid Highlight; }
  tr.is-changed { outline: 1px solid Highlight; }
}
`;
