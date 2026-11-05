# Referencing an unreadable link

Issue: [#119](https://github.com/link-foundation/ui/issues/119), found in the
[issue-101 case study](../issue-101/solutions.md) (R13).

## The leak

A request as a subject runs through `withPermissions`, but `transact` in
`packages/ui-links/src/query.js` checked its references on `context.base`, the
storage below that view. So, as a subject that may not read the secret:

| Request                                   | Secret (exists, hidden) | 9999 (missing)            |
| ----------------------------------------- | ----------------------- | ------------------------- |
| `(create: (Note <address>))`              | success                 | `Link not found: 9999`    |
| `() ((<address>: Note Note))`             | `Link <address> exists` | success                   |
| `(create: (Note secret))` / `(… nothing)` | success, by name        | `Link not found: nothing` |

Each row tells the subject whether a hidden link exists. Worse, the subject's
own link now points at a link it was never allowed to know about.

## Options compared

| Option                          | Hidden and missing alike | `User writes Note` still types links as `Note` | Lets a subject link to a hidden link | Rules to add                     |
| ------------------------------- | ------------------------ | ---------------------------------------------- | ------------------------------------ | -------------------------------- |
| Keep the leak                   | no                       | yes                                            | always, for every subject            | none                             |
| Require read                    | yes                      | no: reading `Note` itself needs read on `Doc`  | never                                | read on parents, exposing values |
| New `AllowReference` rule only  | yes                      | only with one more rule per type               | where granted                        | one per type used                |
| `Link not found` for both only  | yes                      | only if something defines what may be used     | —                                    | —                                |
| **Chosen: rule + implied uses** | yes                      | yes                                            | where granted                        | none, unless it is needed        |

"Require read" fails on the type hierarchy. A rule covers the values and
sub-types of its object, not the object's own link, whose source is its parent:
to read `Note` a subject needs read on `Doc`, which also shows every `Secret`.
So a subject that may only write notes could not type a link as `Note`.

"`Link not found` for both" is an answer, not a rule: it still needs a
definition of what a subject may refer to, so it is part of the decision and
not an alternative to it.

## Decision

A reference is a right of its own, and without it an unreadable address answers
`Link not found`, exactly as a missing one. A subject may refer to an address
when any of these holds:

1. it may read the link there;
2. it is that link (a subject may refer to itself);
3. a rule `(r: AllowReference (g: Subject Object))` covers it: `Object` itself
   and the links of type `Object`;
4. it is the `Object` of an `AllowRead` or `AllowWrite` rule of the subject, so
   `User writes Note` is enough to type a link as `Note`.

Rights 2 and 4 reveal nothing new: a subject knows who it is, and a readable
link of that type shows the address of the type already. `AllowReference` does
not allow reading: the link stays hidden from `each`, `count` and names of the
data. `allow(links, markers, 'reference', markers.anything, markers.anything)`
brings the previous behaviour back as an explicit choice.

The check is in `withPermissions`, and `policy.canReference` is optional: a
custom policy without it allows references to readable links only. The check
in `transact` stays: it is what answers for a subject that may refer to an
address with no link there.

What follows the same rule:

- **A reference a link already holds** stays allowed: updating such a link
  adds no knowledge. Once it is replaced it cannot be put back without the
  right.
- **Choosing the address of a new link** (`createAt`) is a reference: the
  answer would otherwise be `Link N exists` or success. A limited subject
  cannot choose addresses, so a query cannot refer forward to an address it
  creates later in the same request, and a query replacing a link it has just
  deleted at the same address fails atomically. Holders of the right (like
  `Anything` read) still can.
- **Names**: a shared `createNames()` store answers for the subject, so the name
  of a link it may not refer to is an unknown name, and taking that name over
  is `Forbidden: hidden name`. Names stored as links already filter by the view.
- **Types it may not write** still answer `Forbidden: update N` for hidden and
  missing alike: the write check runs before the reference check.

## What this does not hide

- **A subject with the right** can tell a hidden link from a missing one, by
  design: that is what the right says.
- **Addresses in readable links**: a readable link's source and target are shown,
  including one that points at a hidden link.
- **Address allocation**: `create` answers with the next free address, which
  shows how many addresses are taken or freed.
- **Name uniqueness**: taking a name held by a hidden link answers `Forbidden`,
  in both name stores, where a free name succeeds. So a subject can learn that
  a name is taken, though not which link holds it.
- **Timing** was not considered, and in-process code holds `.inner` anyway.

## Verification

`packages/ui-links/tests/references.test.js` covers both kinds of subject. Run
against the code before the change (`a9594e9`), 14 of its 18 tests fail; the
other four pin behaviour that must not change. Reproduce with:

```sh
node --test packages/ui-links/tests/references.test.js
node examples/ui-links-permissions.mjs
```

## link-cli

link-cli's `PermissionsDecorator` forwards `reference_exists` to the store below
its view, and
[`permissions.rs`](https://github.com/link-foundation/link-cli/blob/d83f3732a8f4fdfadccaf308ef66d74b45ab7581/rust/src/permissions.rs#L343-L351)
says a subject "may refer to a type it cannot read". From that source it has the
same leak for references; this was read, not run against clink. The decision
is brought there in
[link-cli#161](https://github.com/link-foundation/link-cli/issues/161).
It is now implemented in clink 2.1.1. The shared contract in
`packages/ui-links/tests/clink.test.js` and the permissions example exercise
denied and granted references on both servers, including that a reference
grant leaves its target unreadable. It is no longer a compatibility difference.
