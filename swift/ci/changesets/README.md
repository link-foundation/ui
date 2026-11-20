# Changesets

Add one uniquely named Markdown file for each Swift source or package change.
Write `patch`, `minor`, or `major` on the first line and a user-facing summary
on the second. Keep the entry with the pull request. CI applies the highest bump
and folds all pending summaries into the generated changelog.
