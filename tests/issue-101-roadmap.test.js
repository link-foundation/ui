/**
 * The roadmap of issue 101: its issue sources are valid, every one was
 * created, and docs/ROADMAP.md holds the section the script generates after
 * the section of issue 1, which the issue-1 script keeps when it rewrites the
 * file.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ROADMAP_TAIL_MARKER,
  loadIssues,
  roadmapTail,
} from '../experiments/issue-1/create-roadmap-issues.mjs';
import {
  compareKeys,
  normalise,
  renderBody,
  renderSection,
  validate,
} from '../experiments/issue-101/create-issues.mjs';

const ROOT = 'docs/case-studies/issue-101/roadmap';
const issues = loadIssues(`${ROOT}/issues`).map(normalise).sort(compareKeys);
const state = JSON.parse(readFileSync(`${ROOT}/created-issues.json`, 'utf8'));
const roadmap = readFileSync('docs/ROADMAP.md', 'utf8').replaceAll(
  '\r\n',
  '\n'
);

describe('issue 101 roadmap', () => {
  it('has valid issue sources in both repositories', () => {
    assert.deepEqual(validate(issues), []);
    assert.deepEqual([...new Set(issues.map((issue) => issue.repo))].sort(), [
      'link-cli',
      'ui',
    ]);
  });

  it('created every issue', () => {
    for (const issue of issues) {
      assert.ok(state[issue.key], `${issue.key} has no created issue`);
      assert.match(state[issue.key].url, /^https:\/\/github\.com\//);
    }
  });

  it('resolves references within and across repositories', () => {
    const ui = issues.find((issue) => issue.key === 'U07');
    const body = renderBody(ui, issues, state);
    assert.doesNotMatch(body, /\{\{[A-Z]\d+\}\}/);
    assert.match(
      body,
      new RegExp(`link-foundation/link-cli#${state.L02.number}\\b`)
    );
    assert.match(body, new RegExp(`Tracked in #${state.T01.number}\\b`));
  });

  it('keeps the generated section in docs/ROADMAP.md', () => {
    assert.equal(roadmapTail(roadmap), `\n${renderSection(issues, state)}`);
    assert.equal(
      roadmap.indexOf(ROADMAP_TAIL_MARKER),
      roadmap.lastIndexOf(ROADMAP_TAIL_MARKER)
    );
  });
});
