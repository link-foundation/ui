# Settings in host-owned layouts

`buildPanelModel` exposes the sections and visible fields for a selection.
Use `estimateSection` and `planSectionColumns` with initial values, tabs and
levels to lay out the columns before mounting. With estimated columns the
panel keeps each section in its initial column when a field changes.

Use `mountSettingsRow(container, schema, field, options)` to mount an
individual validated row. The row and panel accept `slots` for label, value,
reset and hint markup, `mountControl` for an asset picker or another editor,
and `layout` to move the row's labeled parts inside host markup. Return the
primary focusable element from a custom control and call the supplied change
handler when its value changes. `mountField` lets custom renderers fall back
to the standard editor. For panel section and tab chrome use
`renderSection` and `renderTab`. The panel retains the native details and
keyboard-operable tab buttons around the rendered content.

The [rich settings example](../../examples/rich-settings.html) mounts an
artwork picker and a keyboard-operable play button in a preview.
