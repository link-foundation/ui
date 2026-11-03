/**
 * Checks the contributor guide: the repository has no issue templates (#133),
 * the pull request template mirrors "Done means", and the agent guide keeps
 * its sections and every roadmap footer convention.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = (path) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
/**
 * Lists the H2 headings of a Markdown file.
 *
 * @param {string} path the file
 * @returns {string[]} the heading texts
 */
const h2 = (path) =>
  read(path)
    .split('\n')
    .filter((line) => line.startsWith('## '))
    .map((line) => line.slice(3).trim());

describe('issue templates', () => {
  it('the repository has no issue templates (#133)', () => {
    assert.equal(existsSync('.github/ISSUE_TEMPLATE'), false);
  });

  it('no current guide links the removed issue forms', () => {
    for (const path of [
      'AGENTS.md',
      'README.md',
      'docs/CONTRIBUTING.md',
      'docs/agents/README.md',
      'docs/agents/conventions.md',
      'docs/agents/writing-issues.md',
      '.github/pull_request_template.md',
    ]) {
      const text = read(path);
      assert.doesNotMatch(text, /issues\/new\/choose/, path);
      assert.doesNotMatch(text, /ISSUE_TEMPLATE\/[a-z]/, path);
    }
  });
});

describe('.github/pull_request_template.md', () => {
  const template = read('.github/pull_request_template.md');

  it('starts with a Fixes line and mirrors "Done means"', () => {
    assert.ok(template.startsWith('Fixes #'));
    for (const needle of [
      'acceptance criterion',
      'CI is green',
      'changeset',
      'screenshots',
      'check:assets',
    ]) {
      assert.ok(template.includes(needle), needle);
    }
  });
});

describe('agent guide', () => {
  it('AGENTS.md is a short entry point that links the guide', () => {
    const agents = read('AGENTS.md');
    assert.ok(agents.trimEnd().split('\n').length < 60);
    assert.doesNotMatch(agents, /Rust/);
    assert.ok(agents.includes('(docs/agents/README.md)'));
    assert.ok(agents.includes('(docs/agents/conventions.md)'));
    for (const command of [
      'npm test',
      'npm run lint',
      'npm run format:check',
      'npm run check:duplication',
    ]) {
      assert.ok(agents.includes(command), command);
    }
  });

  it('CLAUDE.md points to AGENTS.md', () => {
    assert.equal(read('CLAUDE.md').trim(), 'See [AGENTS.md](AGENTS.md).');
  });

  it('docs/agents/README.md has the workflow sections', () => {
    assert.deepEqual(h2('docs/agents/README.md'), [
      'Pick an issue',
      'Plan',
      'Write tests first',
      'LiNo first',
      'Verify UI',
      'Licensing',
      'Changesets',
      'Hand-off',
      'When stuck',
    ]);
  });

  it('docs/agents/writing-issues.md has the issue-writing sections', () => {
    const sections = h2('docs/agents/writing-issues.md');
    for (const heading of [
      'Required sections',
      'Concrete names',
      'Acceptance criteria',
      'How to verify',
      'Length',
      'LiNo examples',
      'No copyrighted text',
    ]) {
      assert.ok(sections.includes(heading), heading);
    }
    assert.ok(read('docs/agents/writing-issues.md').includes('/issues/14'));
  });

  it('docs/agents/conventions.md carries every footer convention', () => {
    const conventions = read('docs/agents/conventions.md');
    const footer = read('docs/case-studies/issue-1/roadmap/issue-footer.md');
    const rules = [...footer.matchAll(/^- \*\*([^*]+)\*\*/gm)].map(
      (match) => match[1]
    );
    assert.ok(rules.length >= 10, rules.join(', '));
    for (const rule of rules) {
      assert.ok(conventions.includes(`- **${rule}**`), rule);
    }
  });
});
