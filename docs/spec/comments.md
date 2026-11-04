# Comments and per-object agent tasks

Issue [#147](https://github.com/link-foundation/ui/issues/147) adds the
`ui-comments` interchange format, version `1`, owned by
`@link-foundation/ui-devmode/comments`. This is a separate annotation document,
read with ui-core `parseLinks` (the official Links Notation parser), rather
than an element kind in the core UI vocabulary. It never executes instructions
or applies application patches.

A review has one named `ui-comments` root and exactly one `version 1` field.
Its children are named `revision`, `task` and `event` links. Task and event fields
are single atoms; a revision's `source` contains the canonical UI tree as
nested links. The reader
accepts nested and parenthesized LiNo and rejects unknown fields, duplicate
fields/IDs, missing fields, unsupported versions and inconsistent history.

For example, the model produces:

```lino
ui-review: ui-comments
  version 1
  revision-1: revision
    source
      ok: button
        label OK
  task-1: task
    target ok
    kind button
    revision revision-1
    instruction 'Use Save changes'
    input text
    status open
  event-1: event
    task task-1
    action create
    target ok
    kind button
    revision revision-1
    instruction 'Use Save changes'
    input text
    status open
```

The source contains the actual document for an agent to read. Writers use
`formatLinks` in nested form, including the official atom encoding of arbitrary
Unicode, quotes and multiline instructions.

| Link       | Fields and constraints                                                                                                                                                                                                                                     |
| ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `revision` | `source`: exact canonical UI document snapshot. Existing IDs are retained; anonymous elements receive their actual adapter IDs in the snapshot only.                                                                                                       |
| `task`     | `target`: ID in the referenced snapshot; `kind`: matching element kind; `revision`: existing revision ID; `instruction`: nonblank, at most 4,000 characters; `input`: `text` or `voice`; `status`: `open` or `resolved`.                                   |
| `event`    | `task`: task ID; `action`: `create`, `update` or `remove`; all six task fields record the state at that event. Events are ordered, append-only during editing, and replay must equal the current tasks. Target, kind, revision and input remain immutable. |

A batch deduplicates selected IDs and creates one task per object, including
separately selected ancestors and descendants. It validates the complete batch
before changing anything. Each object's instruction and status can then be
edited independently. Revisions are deduplicated by exact source equality;
subsequent requests against changed UI receive another revision. UI edits stay
in the existing designer/store or configuration history. Comment edits stay
in the review's event history. No real clock or random ID source is needed.

An agent should read open tasks and their referenced snapshots, compare that
source to the current document, and check target IDs before editing. The panel
shows `current`, `outdated` (any document change), or `missing` (target removed).
These are computed states, not promises that an instruction was applied.
Resolving a task is a human workflow action; the framework never infers success.
Removed targets retain their tasks and history for review.

Input is bounded to 1,048,576 characters, depth 80 for the review envelope and depth 64
for each source snapshot, 500 current tasks, 100 revisions and 2,000 events.
Over-budget changes are rejected atomically. Import replaces the current review
only after full validation. Comments remain plain text in the DOM, including
markup-looking strings. Imported source is parsed for identity validation and
is never rendered or evaluated.

The freehand lasso is a closed polygon in viewport CSS pixels. It selects
objects whose rectangle corners or edges intersect the polygon. Rectangles
that wholly enclose it are excluded, so large ancestor containers do not
swallow a small gesture. Pick or use the keyboard checkbox list to select
such a container explicitly. Shift adds lasso results to the selection.
Gestures are bounded to 2,048 points and cancel on Escape, pointer cancellation,
blur or scrolling. Picking consumes pointer/click events before app actions.

Comments can describe locked elements because they do not edit those elements.
The dev-mode `enabled` policy still controls entry; comment tasks grant no
permission to bypass editing policy. Disabled dev mode never loads the module.

Text entry is always available. Voice input feature-detects `SpeechRecognition`
or `webkitSpeechRecognition`, starts only after a user gesture, and uses the
browser's service and permission flow. Final transcripts fill an editable
instruction; **Add tasks** is still explicit. Unsupported services, denial and
startup errors leave text entry usable. Stop/close abort recognition and ignore
late callbacks. Tests inject a deterministic recognition service; they do not
require a network connection or microphone.
