export const CSS = `
.network-editor {font: 15px/1.5 system-ui,sans-serif;color:var(--network-editor-fg,#18202b);background:var(--network-editor-bg,#fff);padding:1rem;display:grid;gap:1rem}
.network-editor fieldset {min-width:0;border:1px solid #77818d;border-radius:.5rem;padding:1rem;display:flex;flex-wrap:wrap;gap:.75rem;align-items:start}
.network-editor legend {font-weight:650;padding:0 .4rem}
.network-editor label {display:flex;flex-direction:column;gap:.25rem;min-width:10rem;max-width:100%}
.network-editor input,.network-editor select,.network-editor button {font:inherit;max-width:100%;box-sizing:border-box;min-height:2.5rem}
.network-editor input:not([type=checkbox]):not([type=color]),.network-editor select {width:100%}
.network-editor input[type=checkbox] {align-self:start}
.network-editor button {cursor:pointer;padding:.35rem .7rem}
.network-editor button:disabled {cursor:default}
.network-editor :focus-visible {outline:3px solid #235bd6;outline-offset:2px}
.network-editor [aria-invalid=true] {outline:2px solid #b00020}
.network-editor [role=alert] {color:#b00020}
.network-editor nav {display:flex;flex-wrap:wrap;gap:1rem;width:100%}
.network-editor nav a {color:inherit;text-decoration:underline}
.network-editor [hidden] {display:none!important}
.network-editor p {width:100%;margin:0}
@media(prefers-color-scheme:dark) {.network-editor {--network-editor-fg:#f3f4f6;--network-editor-bg:#151b24;color-scheme:dark}.network-editor [role=alert]{color:#ffb4bd}}
`;
