# Writing issues an agent can solve

Most issues in this repository are solved by AI coding agents, many of them
less capable than the agent or person who wrote the issue. An issue is ready
when such an agent can deliver it without asking a question. Use the
[Feature or Bug form](https://github.com/link-foundation/ui/issues/new/choose);
the forms ask for the sections below.

**Model issue:** [#14 — ui-core: parse Links Notation into the UI element tree](https://github.com/link-foundation/ui/issues/14).
Its source file is
[`docs/case-studies/issue-1/roadmap/issues/F06.md`](../case-studies/issue-1/roadmap/issues/F06.md),
and the template is described in the
[roadmap README](../case-studies/issue-1/roadmap/README.md#issue-body-template).

## Required sections

Feature issues use these sections, in this order. The Feature form produces
them with the same headings.

| Section                   | Purpose                                                                     |
| ------------------------- | --------------------------------------------------------------------------- |
| Context                   | Why the work is needed: the current state, with links to files and issues.  |
| Goal                      | One or two sentences on the outcome.                                        |
| Scope: In scope           | The exact deliverables (packages, files, functions).                        |
| Scope: Out of scope       | What not to do, with the issue that owns it.                                |
| Dependencies              | Blocking issues and what each provides; related issues.                     |
| Step-by-step plan         | Numbered steps an agent can follow in order.                                |
| Files to create or change | Every path the pull request touches.                                        |
| Acceptance criteria       | `- [ ]` checkboxes, each objectively verifiable.                            |
| How to verify             | The exact commands, in a `bash` block, with the expected result.            |
| Prior art and libraries   | Upstream code, specifications and permissively licensed libraries to reuse. |
| References                | Links to documents, specifications and issues.                              |
| Requirements (optional)   | Requirement IDs such as `R2, R6` from the roadmap requirement list.         |

Bug issues use Summary, Steps to reproduce, Expected behaviour, Actual
behaviour, Logs, Environment, Suspected cause, Acceptance criteria and How to
verify.

## Concrete names

Name everything an agent would otherwise have to guess:

- the package and its directory: `@link-foundation/ui-core` in
  `packages/ui-core/`;
- every file to create or change, with its full path;
- public functions with their JSDoc signatures, for example:

  ```js
  /**
   * @param {string} source Links Notation text
   * @returns {UiElement[]} the element tree
   */
  export function parseUi(source) {}
  ```

- the LiNo input and the expected output for at least one example, and the
  fixture directory that will hold the test cases (`docs/spec/fixtures/`);
- the commands, scripts and CI workflows involved
  (`npm run test:ui`, `.github/workflows/ui-tests.yml`).

## Acceptance criteria

Every criterion must be checkable by a command, a test or a screenshot. Write
"`parseUi('(app)')` returns one element with kind `app`", not "parsing works
well". Avoid words such as _fast_, _clean_, _intuitive_ or _robust_ unless you
give a number or a check. Include the quality gates that apply:

- [ ] `npm test`, `npm run lint` and `npm run format:check` pass.
- [ ] Screenshots of the changed UI are attached to the pull request.

## How to verify

Give the exact commands, in order, starting from a clean checkout:

```bash
npm ci
node --test packages/ui-core/tests/parse.test.js
npm test && npm run lint && npm run format:check
```

Say what each command should print or return when the issue is done. For UI
work, say which page to open and what to look at.

## Length

Aim for roughly 90–200 lines. Shorter issues usually miss the plan or the
verification; longer issues usually cover more than one reviewable pull
request (about 1,500 changed lines of source). Split such an issue and connect
the parts with "blocked by" relations.

## LiNo examples

LiNo examples must parse with the official `links-notation` package. The
rules in [`docs/spec/values.md`](../spec/values.md) apply:

- quote hex colours: `'#6750A4'`, because a bare `#` starts a comment;
- quote URLs: `'https://example.com/logo.svg'`, because a bare value must not
  contain `:`;
- use a `lino` code block, so the example can be copied into a fixture:

  ```lino
  (chip: style (background '#6750A4'))
  (logo: image 'https://example.com/logo.svg' (aspect 16 9))
  ```

## No copyrighted text

Do not paste text, code or images from other projects or design systems into
an issue. Link to the source and describe it in your own words. Code and assets
an issue asks for must come from permissively licensed sources, as described
in [`docs/licensing.md`](../licensing.md).

## Conventions footer

Roadmap issues end with the conventions footer. New issues may link
[`docs/agents/conventions.md`](conventions.md) instead of copying it.
