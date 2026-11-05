---
'@link-foundation/ui-links': minor
---

A reference needs a right: without it an unreadable address answers `Link not found`, exactly as a missing one, so a subject can no longer learn that a hidden link exists. Add the `AllowReference` rule (`allow(links, markers, 'reference', subject, object)`) and `policy.canReference`; a rule naming a type, reading a link, or being the link also allows it. Choosing the address of a new link and resolving a name follow the same rule. `allow(links, markers, 'reference', markers.anything, markers.anything)` restores the previous behaviour.
