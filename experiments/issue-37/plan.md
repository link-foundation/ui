# Issue 37 implementation and verification

Both dependencies (#33 and #24) are closed. Issue 37 has no comments,
sub-issues or later feedback; PR 137 has no conversation comments, inline
comments or reviews at the start of work.

1. Export data package and implement measured offsets, binary search, overscan,
   keyed anchor preservation; tests for 0, 1, 10, 100000 and variable heights.
2. Share one animation-frame-deferred ResizeObserver and viewport between kinds.
3. Implement pure single/multi/range selection and stable three-state sorting.
4. Register LiNo list/tree/table kinds, vocabulary, data binding and templates;
   retain focused rows, full collection ARIA metadata, keyboard/typeahead,
   lazy children, column resize, sticky headers, caption and status states.
5. Provide a 100000-row list, 2000-node tree, 10000-row table example.
6. Verify browser row bounds, prepend 50 within 1 px, APG keys, stable sort and
   aria-sort, nested wheel/touch/keyboard scroll, and axe. Commit screenshots
   of item 50000, three-level tree and age-sorted table.
7. Add changesets, review whole diff, commit, run required gates on exact head,
   push only issue-37-e4cea432a339, collect all same-SHA CI results/logs,
   update PR evidence and mark ready only after passing CI. Do not merge.

Implementation assumptions and public host contracts will be documented in the
package README and PR. Logs stay outside tracked source; experiments stay here.
