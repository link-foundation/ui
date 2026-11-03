---
'@link-foundation/ui-designer': minor
'@link-foundation/ui-devmode': patch
'@link-foundation/ui-dom': patch
---

Add a LiNo WYSIWYG designer with docked panels, transactional visual editing,
snapping, keyboard paths and source-preserving two-way synchronization.
Keep designer control renderers local to each mount so host renderers stay intact.
Expose the devmode property grid and overlay for reuse by the designer.
Resolve devmode model policy declarations through package exports for Deno.
Patch positional store edits in place so defaults and source/property edits
appear immediately on the canvas, preserving explicit properties and DOM
identity through undo/redo.
