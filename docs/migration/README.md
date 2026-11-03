# Migration guides

Use this set when moving an existing application to the associative UI framework.
Keep its public contracts and visual baselines while replacing one piece at a time.

- [Playbook](playbook.md): follow the nine phases in order, from the licence
  gate through deletion, with entry criteria and exit checks for each phase.
- [MUI mapping](mui-mapping.md): translate components, props, themes and icons
  manually; consult the Chakra v2/v3 appendix for Chakra applications.
- [Checklist template](checklist-template.md): copy it into each migration PR
  and replace placeholders with paths, tests and screenshots.

The migration work is tracked in [#66–#73](https://github.com/link-foundation/ui/issues/73).
This guide does not perform those migrations. The remaining-projects inventory
belongs to #73. Start at this [index](README.md) when choosing a guide.

## Before and after examples

These small pairs illustrate manual translation, without adding MUI as a dependency:

| Screen     | Before (MUI JSX)                   | After (LiNo)                         |
| ---------- | ---------------------------------- | ------------------------------------ |
| Button row | [JSX](examples/mui-button-row.jsx) | [LiNo](examples/mui-button-row.lino) |
| Form       | [JSX](examples/mui-form.jsx)       | [LiNo](examples/mui-form.lino)       |
| Dialog     | [JSX](examples/mui-dialog.jsx)     | [LiNo](examples/mui-dialog.lino)     |

The JSX functions receive host callbacks. In LiNo, `emit save-document`,
`emit cancel` and `emit save-profile` are named host events, never executable
JavaScript. Register the components with `registerControls()` and import the
layout/overlay entry points; mount with ui-dom's `mountDocument` and dispatch
`onAction` to the same host operations. Load `controls.css`, `layout.css` and
`overlays.css`. Use `mountControls` when control changes must also write to a
store. The form is a field group: the host owns validation and persistence;
it is not a native submit form. The dialog pair shows the initially open state;
the host owns opening and completion, receives `dialog-closed` through `onAction`,
and the renderer supplies Close/Escape.

The examples preserve intent, labels and named actions; the target application's
screenshots still decide visual equivalence. They are English teaching samples;
production strings belong in the [i18n catalogs](../../packages/ui-i18n/README.md).

```bash
node --test tests/docs/migration-examples.test.js
```

The test discovers every example, uses the official `links-notation` parser,
checks UI diagnostics and checks kinds against the exported component catalogs.
It also runs in `npm test` and therefore in CI.
