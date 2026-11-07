# Network presentation providers

`createNetworkPresentation` from `@link-foundation/ui-components/links-view`
is a host backend bridge for geometry, solving and exports. It does not claim
that the framework's default geometry matches a consumer's custom renderer.
A provider supplies `geometry(request)` and `svg(snapshot)`, and optionally
`solve(request)` and `raster(request)`.

Input contains network `items`, an arbitrary-precision nonnegative decimal
`index` **string**, and `options` as Links Notation text. The bridge validates
options with the official parser and preserves the text verbatim. A partial
`update` retains all omitted input, so changing network size/index does not
reset styles, marker settings, turns or gaps. Hosts serialize their documented
backend-specific option vocabulary with `formatLinks`; the bridge does not
invent or discard backend geometry fields.

Geometry and solve requests receive detached input/frame snapshots and an
AbortSignal. They return a structured-cloneable frame containing `positions`
and `pins` maps plus finite positive `bounds` (`x`, `y`, `width`, `height`).
Additional cloneable backend data can include curves, painted-marker clearance,
solver scores, captions, cards and fit margins. Coordinates must be finite.
Solver policy, including prioritizing turns over gaps, belongs to the provider.

Only the latest job commits. New jobs abort previous ones, and late successes
or errors are discarded even if a backend ignores cancellation. Failed input
validation leaves the current job and displayed frame untouched. A failed
backend leaves the last committed input and frame intact. Providers cannot
mutate committed state through request or snapshot references. `subscribe`
notifies the host after a commit, providing the same state for URL/history and
saved-style synchronization. `dispose` aborts work and clears subscriptions;
a host retains ownership of provider-specific workers and resources.

`toSvg()` passes a detached snapshot to the provider's synchronous SVG renderer.
It must return deterministic, trusted SVG markup for that snapshot. No alternate
export geometry is computed. `toRaster(type, options)` captures the SVG and frame
at one revision before encoding; a custom raster provider receives both.
Supported types are PNG, JPEG and WebP. The default encoder scales the SVG,
adds the explicit background matte for JPEG, bounds allocation to 16,777,216
pixels by default, rejects encoding fallback to a different MIME type, and
always revokes the object URL. The existing `networkToPng` helper retains its
legacy dimension behavior; use the new raster API to configure a pixel limit. Fonts must be loaded or embedded by the host
before preview/export; deterministic font embedding is a provider concern.

`toLino()` exports index, options, positions, solver pins and bounds in nested
LiNo for inspection. It is not a full backend-data persistence format. Hosts
persist network items and additional provider data using their own documented
LiNo schema.

Assign a prepared presentation to `<links-network>.presentation` to render its
SVG and expose its positions and solver pins. The element's `toSvg()` returns
the same provider markup. `layout()` calls the provider's solver. Updating
`items` forwards to the provider. Both item updates and `layout()` replace
`ready`, so awaiting it also waits for solver pins before export. Failed jobs
reject `ready`, emit `layouterror` and populate `diagnostics`; the next commit
clears those diagnostics. Store, raw links
and position setters require detaching the presentation. Detach an existing
store before assigning a presentation; source attributes are ignored while a
presentation owns the scene. The provider owns its
SVG's dimensions, style, navigation and marker semantics. The existing element
selection/pan state does not modify provider SVG; implement those interactions
in the host adapter. Reconnection resubscribes to the current snapshot.
The element does not dispose the host-owned presentation.

Consumer parity remains a separate acceptance check: single continuous curves,
self-references, nine marker shapes, neutral/anchored turns and gaps, painted
clearance solving, history traversal and caption/export formats must all be
verified against the consumer before deleting its backend.
