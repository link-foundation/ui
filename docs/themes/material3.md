# Material 3 and MUI mapping

Rendered by `node packages/ui-themes/scripts/mapping-to-md.mjs`; edit
`themes/material3/mui-mapping.lino` as the canonical table.

Load `material3` with `loadTheme('material3')`. The committed baseline seed
is `#6750A4`; colors come from material-color-utilities 0.3.0, tonal-spot.
`materialThemeFromSeed(seed, { id, variant, contrast })` returns a LiNo theme
extending material3, with complete light, dark and high-contrast color roles.
Load that text alongside the shipped theme's chain with the #47 engine.
High contrast is a light scheme at contrast level 1 and wins over dark when
both axes are active. Contrast ranges from -1 to 1; variants are tonal-spot,
vibrant and neutral. Roboto is named, never bundled.

`muiThemeToLino(options, { id })` returns `{ lino, unmapped }`. It imports
palette roles, numeric spacing, border radius, font family, breakpoint values
and duration values. Unsupported leaf paths (including functions and arrays)
are reported, never executed. The theme's `scheme` metadata records
palette.mode; apply that scheme to the theme boundary. Dark palette overrides
are scoped to dark mode. Contrast adjustment remains the engine's job.

`getMuiMapping()` asynchronously reads the table into plain objects.
A target value `*` preserves the incoming value. All supported rows are
partial: only the explicit prop translations are promised. Unknown props,
JSX, sx and MUI X are outside this converter. A none row has no equivalent.

The [gallery](../../examples/themes/material3.html) shows the controls in all
three schemes. Source token names are recorded as `(m3 md.sys.*)` in each
token's metadata. Elevation height tokens preserve the M3 dp scale;
shadow tokens preserve the key and ambient layers (30% and 15%). The full corner token
uses 9999px to render a capsule. Motion emphasized easing retains its two
cubic segments; no single cubic approximation is presented as the M3 path.

| MUI component    | UI kind       | Status  | Prop translations                                                                                                                                                                                                                            |
| ---------------- | ------------- | ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Button           | `button`      | partial | `variant=contained` → `variant=filled`; `variant=outlined` → `variant=outlined`; `variant=text` → `variant=text`; `disabled=*` → `disabled=*`                                                                                                |
| IconButton       | `icon-button` | partial | `disabled=*` → `disabled=*`; `aria-label=*` → `label=*`                                                                                                                                                                                      |
| TextField        | `text-field`  | partial | `variant=filled` → `variant=filled`; `variant=outlined` → `variant=outlined`; `label=*` → `label=*`; `value=*` → `value=*`; `disabled=*` → `disabled=*`; `required=*` → `required=*`; `name=*` → `name=*`; `placeholder=*` → `placeholder=*` |
| Checkbox         | `checkbox`    | partial | `checked=*` → `checked=*`; `disabled=*` → `disabled=*`; `name=*` → `name=*`; `value=*` → `value=*`                                                                                                                                           |
| Radio            | `radio`       | partial | `value=*` → `value=*`; `disabled=*` → `disabled=*`                                                                                                                                                                                           |
| RadioGroup       | `radio-group` | partial | `value=*` → `value=*`; `name=*` → `name=*`                                                                                                                                                                                                   |
| Switch           | `switch`      | partial | `checked=*` → `checked=*`; `disabled=*` → `disabled=*`                                                                                                                                                                                       |
| Slider           | `slider`      | partial | `value=*` → `value=*`; `min=*` → `min=*`; `max=*` → `max=*`; `step=*` → `step=*`; `disabled=*` → `disabled=*`                                                                                                                                |
| Select           | `select`      | partial | —                                                                                                                                                                                                                                            |
| Dialog           | `dialog`      | partial | —                                                                                                                                                                                                                                            |
| Menu             | `menu`        | partial | —                                                                                                                                                                                                                                            |
| Tooltip          | `tooltip`     | partial | —                                                                                                                                                                                                                                            |
| Snackbar         | `toast`       | partial | —                                                                                                                                                                                                                                            |
| Drawer           | `drawer`      | partial | —                                                                                                                                                                                                                                            |
| AppBar           | —             | none    | —                                                                                                                                                                                                                                            |
| Tabs             | `tabs`        | partial | —                                                                                                                                                                                                                                            |
| Card             | —             | none    | —                                                                                                                                                                                                                                            |
| List             | `list`        | partial | —                                                                                                                                                                                                                                            |
| Table            | `table`       | partial | —                                                                                                                                                                                                                                            |
| Chip             | —             | none    | —                                                                                                                                                                                                                                            |
| Avatar           | `avatar`      | partial | `src=*` → `source=*`                                                                                                                                                                                                                         |
| Badge            | `badge`       | partial | `badgeContent=*` → `value=*`                                                                                                                                                                                                                 |
| Box              | `stack`       | partial | —                                                                                                                                                                                                                                            |
| Stack            | `stack`       | partial | `direction=row` → `direction=horizontal`; `direction=column` → `direction=vertical`                                                                                                                                                          |
| Grid             | `grid`        | partial | —                                                                                                                                                                                                                                            |
| Typography       | `text`        | partial | —                                                                                                                                                                                                                                            |
| CircularProgress | `progress`    | partial | `value=*` → `value=*`                                                                                                                                                                                                                        |
