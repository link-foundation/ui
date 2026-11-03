/** Modal drawers use <dialog>; docked drawers share the dialog controller. */
import { createDialog } from './dialog.js';
import { make, registerOverlay } from './dom.js';
registerOverlay(
  'drawer',
  (el, ctx) => make(ctx.document, 'dialog', { hidden: true }),
  createDialog
);
