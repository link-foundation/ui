#!/usr/bin/env node
// Creates (or updates) the roadmap issues planned in the issue-1 case study.
//
// Source of truth: docs/case-studies/issue-1/roadmap/issues/*.md. Each file
// starts with a front matter block:
//
//   ---
//   key: F06
//   title: 'ui-core: parse, project, validate and format UI documents'
//   type: Feature            # Bug | Feature | Task (GitHub issue type)
//   labels: [enhancement]
//   phase: 2
//   blocked_by: [F01, F03]
//   requirements: [R2, R3]
//   ---
//
// In bodies, `{{F06}}` is replaced by the GitHub reference of that issue
// (`#123`) once every issue exists.
//
// The script is idempotent. Created issue numbers and IDs are stored in
// docs/case-studies/issue-1/roadmap/created-issues.json, so re-running it only
// creates what is missing, refreshes bodies, and adds missing "blocked by"
// relations (GitHub issue dependencies API) and sub-issue links to the
// tracking issue.
//
// Usage:
//   node experiments/issue-1/create-roadmap-issues.mjs --dry-run
//   node experiments/issue-1/create-roadmap-issues.mjs
//
// Environment: REPO (default link-foundation/ui), DEBUG=1 for verbose logs.

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = process.env.REPO ?? 'link-foundation/ui';
const ROOT = 'docs/case-studies/issue-1/roadmap';
const ISSUES_DIR = join(ROOT, 'issues');
const STATE_FILE = join(ROOT, 'created-issues.json');
const ROADMAP_FILE = 'docs/ROADMAP.md';
const DRY_RUN = process.argv.includes('--dry-run');
const debug = (...args) => {
  if (process.env.DEBUG) {
    console.error('[debug]', ...args);
  }
};

const parseValue = (raw) => {
  const value = raw.trim();
  if (value.startsWith('[') && value.endsWith(']')) {
    return value
      .slice(1, -1)
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }
  if (
    (value.startsWith("'") && value.endsWith("'")) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
};

export const parseIssueFile = (text, file = '<input>') => {
  const match = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    throw new Error(`${file}: missing front matter`);
  }
  const meta = {};
  for (const line of match[1].split('\n')) {
    const separator = line.indexOf(':');
    if (separator <= 0 || line.trim().startsWith('#')) {
      continue;
    }
    const key = line.slice(0, separator).trim();
    meta[key] = parseValue(line.slice(separator + 1).replace(/\s+#.*$/, ''));
  }
  for (const required of ['key', 'title', 'type']) {
    if (!meta[required]) {
      throw new Error(`${file}: front matter needs "${required}"`);
    }
  }
  return {
    ...meta,
    labels: meta.labels ?? [],
    blocked_by: meta.blocked_by ?? [],
    requirements: meta.requirements ?? [],
    body: match[2].trim(),
    file,
  };
};

// Bugs first (B*), then features in key order (F01, F02, ...), then tasks.
export const sortKey = (key) => {
  const order = { B: 0, F: 1, T: 2 };
  return [order[key[0]] ?? 9, Number(key.slice(1))];
};
const compareKeys = (a, b) => {
  const [ga, na] = sortKey(a.key);
  const [gb, nb] = sortKey(b.key);
  return ga - gb || na - nb;
};

export const loadIssues = (dir = ISSUES_DIR) =>
  readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) =>
      parseIssueFile(readFileSync(join(dir, name), 'utf8'), join(dir, name))
    )
    .sort(compareKeys);

// Returns `#N` references outside code that GitHub would autolink to this
// repository: not preceded by a word character, `&` or `[` (markdown
// link text whose target is given explicitly).
export const findBareIssueRefs = (markdown) => {
  const prose = markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/`[^`\n]*`/g, '')
    .replace(/\]\([^)]*\)/g, ']');
  return [...prose.matchAll(/(?<![\w&[])#\d+\b/g)].map((m) => m[0]);
};

export const validateIssues = (issues) => {
  const keys = new Set(issues.map((issue) => issue.key));
  const errors = [];
  for (const issue of issues) {
    for (const blocker of issue.blocked_by) {
      if (!keys.has(blocker)) {
        errors.push(`${issue.key}: unknown blocker ${blocker}`);
      }
    }
    for (const ref of issue.body.matchAll(/\{\{([A-Z]\d+)\}\}/g)) {
      if (!keys.has(ref[1])) {
        errors.push(`${issue.key}: unknown reference {{${ref[1]}}}`);
      }
    }
    // A bare `#N` in an issue body links to an issue of THIS repository, so a
    // reference to another repository's issue must be written as
    // `owner/repo#N` or as a full URL. Only `#1` (the planning issue) is bare.
    for (const ref of findBareIssueRefs(issue.body)) {
      if (ref !== '#1') {
        errors.push(`${issue.key}: bare issue reference ${ref}`);
      }
    }
    if (
      issue.key.startsWith('F') &&
      issue.blocked_by.some((b) => b === issue.key)
    ) {
      errors.push(`${issue.key}: blocks itself`);
    }
  }
  // Detect dependency cycles with a depth-first search.
  const byKey = new Map(issues.map((issue) => [issue.key, issue]));
  const state = new Map();
  const visit = (key, path) => {
    if (state.get(key) === 'done') {
      return;
    }
    if (state.get(key) === 'active') {
      errors.push(`dependency cycle: ${[...path, key].join(' -> ')}`);
      return;
    }
    state.set(key, 'active');
    for (const blocker of byKey.get(key)?.blocked_by ?? []) {
      visit(blocker, [...path, key]);
    }
    state.set(key, 'done');
  };
  for (const issue of issues) {
    visit(issue.key, []);
  }
  return errors;
};

const gh = (args, input) => {
  debug('gh', args.join(' '));
  return execFileSync('gh', args, {
    encoding: 'utf8',
    input,
    stdio: ['pipe', 'pipe', 'inherit'],
  });
};
// GitHub's secondary rate limit allows about 80 content-creating requests per
// minute, so every mutating call waits a little before it runs.
const MUTATION_PAUSE_MS = Number(process.env.ROADMAP_PAUSE_MS ?? 1000);
const pause = (ms) =>
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
const ghJson = (args, payload) => {
  pause(MUTATION_PAUSE_MS);
  return JSON.parse(gh([...args, '--input', '-'], JSON.stringify(payload)));
};

const loadState = () =>
  existsSync(STATE_FILE) ? JSON.parse(readFileSync(STATE_FILE, 'utf8')) : {};
const saveState = (state) =>
  writeFileSync(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);

const FOOTER_FILE = join(ROOT, 'issue-footer.md');
const footer = existsSync(FOOTER_FILE)
  ? readFileSync(FOOTER_FILE, 'utf8').trim()
  : '';

export const resolveReferences = (text, state) =>
  text.replace(/\{\{([A-Z]\d+)\}\}/g, (whole, key) =>
    state[key] ? `#${state[key].number}` : whole
  );

// Roadmap issues get the shared conventions footer; the tracking task does not.
const resolveBody = (issue, state) => {
  const body = resolveReferences(issue.body, state);
  return issue.type === 'Task' || !footer ? body : `${body}\n\n${footer}\n`;
};

const createIssue = (issue, state) => {
  const created = ghJson(['api', '-X', 'POST', `repos/${REPO}/issues`], {
    title: issue.title,
    body: resolveBody(issue, state),
    labels: issue.labels,
    type: issue.type,
  });
  state[issue.key] = {
    number: created.number,
    id: created.id,
    url: created.html_url,
    title: issue.title,
  };
  saveState(state);
  console.log(`created ${issue.key} -> #${created.number} ${issue.title}`);
};

const updateIssue = (issue, state) => {
  const entry = state[issue.key];
  ghJson(['api', '-X', 'PATCH', `repos/${REPO}/issues/${entry.number}`], {
    title: issue.title,
    body: resolveBody(issue, state),
    labels: issue.labels,
    type: issue.type,
  });
  entry.title = issue.title;
  saveState(state);
  console.log(`updated ${issue.key} (#${entry.number})`);
};

const existingIds = (path) =>
  new Set(
    JSON.parse(gh(['api', '--paginate', '--slurp', path]))
      .flat()
      .map((item) => item.id)
  );

const linkDependencies = (issue, state) => {
  if (issue.blocked_by.length === 0) {
    return;
  }
  const number = state[issue.key].number;
  const path = `repos/${REPO}/issues/${number}/dependencies/blocked_by`;
  const present = existingIds(path);
  for (const blocker of issue.blocked_by) {
    const blockerId = state[blocker].id;
    if (present.has(blockerId)) {
      continue;
    }
    ghJson(['api', '-X', 'POST', path], { issue_id: blockerId });
    console.log(`  #${number} blocked by #${state[blocker].number}`);
  }
};

const linkSubIssues = (trackingKey, issues, state) => {
  const parent = state[trackingKey];
  const path = `repos/${REPO}/issues/${parent.number}/sub_issues`;
  const present = existingIds(path);
  for (const issue of issues) {
    if (issue.key === trackingKey || present.has(state[issue.key].id)) {
      continue;
    }
    ghJson(['api', '-X', 'POST', path], { sub_issue_id: state[issue.key].id });
    console.log(
      `  #${state[issue.key].number} is a sub-issue of #${parent.number}`
    );
  }
};

const PHASES = {
  0: 'Phase 0 — Bugs',
  1: 'Phase 1 — Foundation',
  2: 'Phase 2 — Core (JavaScript)',
  3: 'Phase 3 — Rendering',
  4: 'Phase 4 — Components',
  5: 'Phase 5 — Themes',
  6: 'Phase 6 — Animation',
  7: 'Phase 7 — Development mode and designer',
  8: 'Phase 8 — Interoperability',
  9: 'Phase 9 — Documentation and demo site',
  10: 'Phase 10 — Migration of existing projects',
};

// docs/ROADMAP.md continues with sections other plans generate (issue 101's
// begins with this marker); rewriting the issue-1 part keeps them.
export const ROADMAP_TAIL_MARKER = '<!-- roadmap section of issue 101 -->';
export const roadmapTail = (text) => {
  const at = text.indexOf(ROADMAP_TAIL_MARKER);
  return at < 0 ? '' : `\n${text.slice(at)}`;
};

const issueLink = (key, state) =>
  state[key] ? `[#${state[key].number}](${state[key].url})` : key;

export const renderRoadmap = (issues, state) => {
  const lines = [
    '# Roadmap',
    '',
    'This roadmap was planned in',
    '[the planning issue](https://github.com/link-foundation/ui/issues/1). The',
    '[issue 1 case study](case-studies/issue-1/README.md) explains every',
    'decision, and [`ARCHITECTURE.md`](ARCHITECTURE.md) describes the target',
    'design. The file is generated by',
    '`experiments/issue-1/create-roadmap-issues.mjs` from',
    '`docs/case-studies/issue-1/roadmap/issues/`.',
    '',
    'Bugs come first. Features can be worked on in parallel as soon as every',
    'issue in their "Blocked by" column is closed; GitHub shows the same',
    'relations as native issue dependencies.',
  ];
  const tracking = issues.find((issue) => issue.type === 'Task');
  if (tracking) {
    lines.push(
      '',
      `Tracking issue: ${issueLink(tracking.key, state)} (${tracking.title}).`
    );
  }
  const phases = [...new Set(issues.map((issue) => issue.phase))]
    .filter((phase) => PHASES[phase])
    .sort((a, b) => Number(a) - Number(b));
  for (const phase of phases) {
    lines.push(
      '',
      `## ${PHASES[phase]}`,
      '',
      '| Issue | Key | Type | Title | Blocked by | Requirements |',
      '| ----- | --- | ---- | ----- | ---------- | ------------ |'
    );
    for (const issue of issues.filter((item) => item.phase === phase)) {
      const blockers = issue.blocked_by.map((key) => issueLink(key, state));
      const title = issue.title.replace(/\|/g, '\\|');
      lines.push(
        `| ${issueLink(issue.key, state)} | ${issue.key} | ${issue.type} | ${title} | ${blockers.join(', ') || '—'} | ${issue.requirements.join(', ')} |`
      );
    }
  }
  return `${lines.join('\n')}\n`;
};

const main = () => {
  const issues = loadIssues();
  const errors = validateIssues(issues);
  if (errors.length > 0) {
    console.error(errors.join('\n'));
    process.exit(1);
  }
  console.log(`${issues.length} roadmap issue files are valid.`);
  if (DRY_RUN) {
    for (const issue of issues) {
      console.log(
        `${issue.key}\t${issue.type}\t[${issue.blocked_by.join(',')}]\t${issue.title}`
      );
    }
    return;
  }
  const state = loadState();
  for (const issue of issues) {
    if (!state[issue.key]) {
      createIssue(issue, state);
    }
  }
  // Second pass: every {{KEY}} reference can now be resolved.
  for (const issue of issues) {
    updateIssue(issue, state);
  }
  for (const issue of issues) {
    linkDependencies(issue, state);
  }
  const tracking = issues.find((issue) => issue.type === 'Task');
  if (tracking) {
    linkSubIssues(tracking.key, issues, state);
  }
  const tail = existsSync(ROADMAP_FILE)
    ? roadmapTail(readFileSync(ROADMAP_FILE, 'utf8'))
    : '';
  writeFileSync(ROADMAP_FILE, renderRoadmap(issues, state) + tail);
  console.log(`wrote ${ROADMAP_FILE}`);
};

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
