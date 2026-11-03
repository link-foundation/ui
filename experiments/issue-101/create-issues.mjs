#!/usr/bin/env node
// Creates (or updates) the issues planned in the issue-101 case study, in two
// repositories: link-foundation/ui and link-foundation/link-cli.
//
// Source of truth: docs/case-studies/issue-101/roadmap/issues/*.md, with the
// front matter of experiments/issue-1/create-roadmap-issues.mjs plus:
//
//   repo: ui | link-cli        # where the issue is created
//   parent: T01 | null         # the tracking issue it is a sub-issue of
//
// In bodies, `{{U04}}` becomes `#N` when the issue is in the same repository
// and `link-foundation/link-cli#N` (or `link-foundation/ui#N`) otherwise.
// Every issue gets a "Dependencies" section listing its blockers and parent,
// so cross-repository relations are visible even where GitHub's dependency
// API refuses them, and the issues under a tracking issue get the footer of
// their repository (roadmap/issue-footer-<repo>.md).
//
// Idempotent: numbers and IDs are kept in roadmap/created-issues.json; a
// re-run creates what is missing, refreshes bodies, and adds missing
// "blocked by" relations and sub-issues.
//
// Usage:
//   node experiments/issue-101/create-issues.mjs --dry-run
//   node experiments/issue-101/create-issues.mjs
//
// Environment: DEBUG=1 for verbose logs, ROADMAP_PAUSE_MS (default 1000).

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  ROADMAP_TAIL_MARKER,
  loadIssues,
  validateIssues,
} from '../issue-1/create-roadmap-issues.mjs';

const ROOT = 'docs/case-studies/issue-101/roadmap';
const STATE_FILE = join(ROOT, 'created-issues.json');
const ROADMAP_FILE = 'docs/ROADMAP.md';
const DRY_RUN = process.argv.includes('--dry-run');
export const REPOS = {
  ui: 'link-foundation/ui',
  'link-cli': 'link-foundation/link-cli',
};
const debug = (...args) => {
  if (process.env.DEBUG) {
    console.error('[debug]', ...args);
  }
};

const ORDER = { T: 0, U: 1, L: 2 };
export const compareKeys = (a, b) =>
  (ORDER[a.key[0]] ?? 9) - (ORDER[b.key[0]] ?? 9) ||
  Number(a.key.slice(1)) - Number(b.key.slice(1));

export const normalise = (issue) => ({
  ...issue,
  parent: issue.parent && issue.parent !== 'null' ? issue.parent : null,
});

/** Errors of the issue-1 checks plus the two-repository fields. */
export const validate = (issues) => {
  const keys = new Set(issues.map((issue) => issue.key));
  const errors = validateIssues(issues);
  for (const issue of issues) {
    if (!REPOS[issue.repo]) {
      errors.push(`${issue.key}: unknown repo ${issue.repo}`);
    }
    if (issue.parent && !keys.has(issue.parent)) {
      errors.push(`${issue.key}: unknown parent ${issue.parent}`);
    }
  }
  return errors;
};

/** `#N` in the same repository, `owner/repo#N` in another one. */
export const reference = (key, from, issues, state) => {
  const target = issues.find((issue) => issue.key === key);
  const entry = state[key];
  if (!entry) {
    return `{{${key}}}`;
  }
  return target.repo === from.repo
    ? `#${entry.number}`
    : `${REPOS[target.repo]}#${entry.number}`;
};

export const resolve = (text, from, issues, state) =>
  text.replace(/\{\{([A-Z]\d+)\}\}/g, (_, key) =>
    reference(key, from, issues, state)
  );

const dependencies = (issue) => {
  const lines = ['## Dependencies', ''];
  lines.push(
    issue.blocked_by.length > 0
      ? `- Blocked by: ${issue.blocked_by.map((key) => `{{${key}}}`).join(', ')}.`
      : '- Blocked by: nothing; it can start now.'
  );
  if (issue.parent) {
    lines.push(`- Tracked in {{${issue.parent}}}.`);
  }
  lines.push(
    `- Requirements of the issue 101 case study: ${issue.requirements.join(', ')}.`
  );
  return lines.join('\n');
};

const footers = {};
const footerOf = (repo) => {
  if (!(repo in footers)) {
    const file = join(ROOT, `issue-footer-${repo}.md`);
    footers[repo] = existsSync(file) ? readFileSync(file, 'utf8').trim() : '';
  }
  return footers[repo];
};

export const renderBody = (issue, issues, state) => {
  const parts = [issue.body, dependencies(issue)];
  if (issue.parent !== null && footerOf(issue.repo)) {
    parts.push(footerOf(issue.repo));
  }
  return `${resolve(parts.join('\n\n'), issue, issues, state)}\n`;
};

const gh = (args, input) => {
  debug('gh', args.join(' '));
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
};
const MUTATION_PAUSE_MS = Number(process.env.ROADMAP_PAUSE_MS ?? 1000);
const pause = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const ghJson = (args, payload) => {
  pause(MUTATION_PAUSE_MS);
  return JSON.parse(gh([...args, '--input', '-'], JSON.stringify(payload)));
};
const existingIds = (path) =>
  new Set(
    JSON.parse(gh(['api', '--paginate', '--slurp', path]))
      .flat()
      .map((item) => item.id)
  );

const loadState = () =>
  existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const saveState = (state) =>
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);

const payload = (issue, issues, state) => ({
  title: issue.title,
  body: renderBody(issue, issues, state),
  labels: issue.labels,
  type: issue.type,
});

const createIssue = (issue, issues, state) => {
  const repo = REPOS[issue.repo];
  const created = ghJson(
    ['api', '-X', 'POST', `repos/${repo}/issues`],
    payload(issue, issues, state)
  );
  state[issue.key] = {
    repo,
    number: created.number,
    id: created.id,
    url: created.html_url,
    title: issue.title,
  };
  saveState(state);
  console.log(`created ${issue.key} -> ${repo}#${created.number}`);
};

const updateIssue = (issue, issues, state) => {
  const entry = state[issue.key];
  ghJson(
    ['api', '-X', 'PATCH', `repos/${entry.repo}/issues/${entry.number}`],
    payload(issue, issues, state)
  );
  entry.title = issue.title;
  saveState(state);
  console.log(`updated ${issue.key} (${entry.repo}#${entry.number})`);
};

/** Adds `id` to a relation list unless it is there; logs a refusal. */
const relate = (path, field, id, message) => {
  try {
    if (existingIds(path).has(id)) {
      return;
    }
    ghJson(['api', '-X', 'POST', path], { [field]: id });
    console.log(`  ${message}`);
  } catch (error) {
    console.log(
      `  could not record: ${message} (${error.message.split('\n')[0]})`
    );
  }
};

const linkRelations = (issue, state) => {
  const entry = state[issue.key];
  const base = `repos/${entry.repo}/issues/${entry.number}`;
  for (const blocker of issue.blocked_by) {
    const other = state[blocker];
    relate(
      `${base}/dependencies/blocked_by`,
      'issue_id',
      other.id,
      `${entry.repo}#${entry.number} blocked by ${other.repo}#${other.number}`
    );
  }
  if (issue.parent) {
    const parent = state[issue.parent];
    relate(
      `repos/${parent.repo}/issues/${parent.number}/sub_issues`,
      'sub_issue_id',
      entry.id,
      `${entry.repo}#${entry.number} is a sub-issue of ${parent.repo}#${parent.number}`
    );
  }
};

const link = (key, state) =>
  state[key]
    ? `[${state[key].repo.split('/')[1]}#${state[key].number}](${state[key].url})`
    : key;

const tableRows = (issues, state) =>
  issues.map((issue) => [
    link(issue.key, state),
    issue.key,
    issue.type,
    issue.title.replace(/\|/g, '\\|'),
    issue.blocked_by.map((key) => link(key, state)).join(', ') || '—',
    issue.requirements.join(', '),
  ]);

/** A Markdown table padded the way Prettier pads it, so it stays formatted. */
export const formatTable = (header, rows) => {
  const widths = header.map((_, column) =>
    Math.max(3, ...[header, ...rows].map((row) => row[column].length))
  );
  const line = (cells) =>
    `| ${cells.map((cell, column) => cell.padEnd(widths[column])).join(' | ')} |`;
  return [
    line(header),
    line(widths.map((width) => '-'.repeat(width))),
    ...rows.map(line),
  ];
};

/** The section of docs/ROADMAP.md for issue 101, from the marker on. */
export const renderSection = (issues, state) => {
  const lines = [
    ROADMAP_TAIL_MARKER,
    '',
    '## Issue 101 — associative links: doublets MVP, then triplets and Deep',
    '',
    '[Issue 101](https://github.com/link-foundation/ui/issues/101) asked for',
    'associative storages behind one interface, a synced client and a server',
    'with permissions stored as links. Its doublets MVP is done:',
    '`packages/ui-links` and the links storage of `packages/ui-store`. The rest',
    'is planned below, here and in link-cli; the',
    '[issue 101 case study](case-studies/issue-101/README.md) explains every',
    'decision. This section is generated by',
    '`experiments/issue-101/create-issues.mjs` from',
    '`docs/case-studies/issue-101/roadmap/issues/`.',
  ];
  const groups = [
    ['Tracking issues', (issue) => issue.parent === null],
    [
      'This repository',
      (issue) => issue.parent !== null && issue.repo === 'ui',
    ],
    ['link-cli', (issue) => issue.parent !== null && issue.repo === 'link-cli'],
  ];
  for (const [heading, keep] of groups) {
    lines.push(
      '',
      `### ${heading}`,
      '',
      ...formatTable(
        ['Issue', 'Key', 'Type', 'Title', 'Blocked by', 'Requirements'],
        tableRows(issues.filter(keep), state)
      )
    );
  }
  return `${lines.join('\n')}\n`;
};

const writeRoadmap = (issues, state) => {
  const text = readFileSync(ROADMAP_FILE, 'utf8');
  const at = text.indexOf(ROADMAP_TAIL_MARKER);
  const head = at < 0 ? `${text.trimEnd()}\n\n` : text.slice(0, at);
  writeFileSync(ROADMAP_FILE, head + renderSection(issues, state));
  console.log(`wrote ${ROADMAP_FILE}`);
};

const main = () => {
  const issues = loadIssues(join(ROOT, 'issues'))
    .map(normalise)
    .sort(compareKeys);
  const errors = validate(issues);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`${issues.length} issue files are valid.`);
  if (DRY_RUN) {
    for (const issue of issues) {
      console.log(
        `${issue.key}\t${issue.repo}\t${issue.type}\t[${issue.blocked_by.join(',')}]\t${issue.parent ?? '-'}\t${issue.title}`
      );
    }
    return;
  }
  const state = loadState();
  for (const issue of issues) {
    if (!state[issue.key]) {
      createIssue(issue, issues, state);
    }
  }
  for (const issue of issues) {
    updateIssue(issue, issues, state);
  }
  for (const issue of issues) {
    linkRelations(issue, state);
  }
  writeRoadmap(issues, state);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
