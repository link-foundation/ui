export const COMMENTS_CSS = `
:host { all: initial; position: fixed; inset: 0; z-index: 2147483647;
  pointer-events: none; font: 14px/1.5 system-ui, sans-serif; color-scheme: light dark;
  color: CanvasText; }
* { box-sizing: border-box; }
.panel { position: fixed; right: 8px; top: 8px; bottom: 8px; width: min(380px, calc(100vw - 16px));
  overflow: auto; pointer-events: auto; background: Canvas; color: CanvasText;
  border: 2px solid CanvasText; border-radius: 8px; padding: 16px; box-shadow: 0 4px 20px #0003; }
h2 { margin: 0 0 8px; font-size: 20px; } h3 { font-size: 16px; margin: 12px 0 4px; }
p { margin: 6px 0; } .actions { display: flex; flex-wrap: wrap; gap: 6px; margin: 8px 0; }
button, textarea { font: inherit; color: CanvasText; background: Canvas; border: 1px solid CanvasText; border-radius: 4px; }
button { appearance: none; padding: 5px 9px; cursor: pointer; }
button[aria-pressed=true] { outline: 2px solid Highlight; outline-offset: 1px; }
button:disabled { opacity: .6; cursor: default; }
:focus-visible { outline: 3px solid Highlight; outline-offset: 2px; }
label { display: block; } textarea { display: block; padding: 6px; width: 100%; min-height: 66px; resize: vertical; }
.objects { max-height: 136px; overflow: auto; border: 1px solid GrayText; padding: 4px; }
.objects label { padding: 2px; overflow-wrap: anywhere; } input { accent-color: Highlight; }
.task { padding: 8px 0; border-bottom: 1px solid GrayText; overflow-wrap: anywhere; }
.meta { font-size: 12px; } output { display: block; white-space: pre-wrap; overflow-wrap: anywhere; }
.marks { position: fixed; inset: 0; pointer-events: none; }
.mark { position: fixed; border: 2px dashed #b3261e; }
.mark.selected { border: 2px solid #1a56db; }
.bubble { position: absolute; left: 0; top: 100%; width: max-content; max-width: 240px; min-width: 100px;
  pointer-events: auto; white-space: pre-wrap; overflow-wrap: anywhere; text-align: left;
  font-size: 12px; background: Canvas; color: CanvasText; border: 2px solid #b3261e; }
svg { position: fixed; inset: 0; width: 100%; height: 100%; pointer-events: none; }
path { fill: rgb(26 86 219 / .12); stroke: #1a56db; stroke-width: 2; }
@media (forced-colors: active) { .mark, .bubble { border-color: Highlight; } }
@media (prefers-reduced-motion: reduce) { * { scroll-behavior: auto; } }
`;
