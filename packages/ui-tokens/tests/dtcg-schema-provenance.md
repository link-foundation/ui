# Resolver schema provenance

The offline JSON Schemas in `assets/data/dtcg-resolver/` were downloaded from
https://www.designtokens.org/schemas/2025.10/resolver.json on 2026-11-03.
The original bundle SHA-256 is
`a5acd14318f3c347ea2d12b4ab0f873d1340e74e957c454d112672e58b1da977`.

The bundle's `definitions` were moved into individual files, retaining their
original `$id` values and all validation rules. Ajv registers them by ID.
This keeps each file below the repository's line limit and makes validation
deterministic without a network request.

Copyright W3C and Design Tokens Community Group Contributors.
The Design Tokens Community Group LICENSE.md places test suites and other
software under the W3C 3-clause BSD License:
https://www.w3.org/Consortium/Legal/2008/03-bsd-license.html.
The source project is https://github.com/design-tokens/community-group.
Asset attribution and the BSD-3-Clause license text are recorded in
`assets/assets.lino` and `LICENSES/BSD-3-Clause.txt`.
