/**
 * Checks the GitHub issue forms, the pull request template and the agent
 * guide: the Feature form mirrors the roadmap issue template
 * section by section, and every form uses unique ids, the required fields
 * and only the allowed labels.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const read = (path) => readFileSync(path, 'utf8').replaceAll('\r\n', '\n');
const loadForm = (name) => parse(read(`.github/ISSUE_TEMPLATE/${name}`));

const feature = loadForm('feature.yml');
const bug = loadForm('bug.yml');
const config = loadForm('config.yml');

const ALLOWED_LABELS = ['bug', 'enhancement', 'documentation'];

const FEATURE_IDS = [
  'context',
  'goal',
  'in-scope',
  'out-of-scope',
  'dependencies',
  'plan',
  'files',
  'acceptance',
  'verify',
  'prior-art',
  'references',
];
const FEATURE_REQUIRED = [
  'context',
  'goal',
  'in-scope',
  'acceptance',
  'verify',
];

const BUG_IDS = [
  'summary',
  'reproduce',
  'expected',
  'actual',
  'logs',
  'environment',
  'suspected-cause',
  'acceptance',
  'verify',
];
const BUG_REQUIRED = [
  'summary',
  'reproduce',
  'expected',
  'actual',
  'acceptance',
];

/** Fields that carry an id (markdown blocks have none). */
const fields = (form) => form.body.filter((field) => field.id !== undefined);
const ids = (form) => fields(form).map((field) => field.id);
const field = (form, id) => fields(form).find((f) => f.id === id);

/**
 * Reads the H2/H3 headings of the "Issue body template" in the roadmap
 * README, in order. A heading directly followed by a deeper heading (such as
 * "Scope" before "In scope") only groups its children, so it has no field.
 *
 * @returns {string[]} the section headings that need a form field
 */
function roadmapTemplateSections() {
  const readme = read('docs/case-studies/issue-1/roadmap/README.md');
  const section = readme.split('\n## Issue body template\n')[1];
  assert.ok(section, 'roadmap README has an "Issue body template" section');
  const block = section.split('```markdown\n')[1].split('\n```\n')[0];
  const headings = block
    .split('\n')
    .filter((line) => line.startsWith('## ') || line.startsWith('### '))
    .map((line) => ({
      level: line.indexOf(' '),
      text: line.slice(line.indexOf(' ') + 1).trim(),
    }));
  return headings
    .filter((h, i) => !(headings[i + 1]?.level > h.level))
    .map((h) => h.text);
}

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

describe('.github/ISSUE_TEMPLATE forms', () => {
  for (const [name, form] of [
    ['feature.yml', feature],
    ['bug.yml', bug],
  ]) {
    it(`${name} uses unique ids`, () => {
      const list = ids(form);
      assert.equal(new Set(list).size, list.length, list.join(', '));
    });

    it(`${name} uses only the allowed labels`, () => {
      assert.ok(Array.isArray(form.labels) && form.labels.length > 0);
      for (const label of form.labels) {
        assert.ok(ALLOWED_LABELS.includes(label), `label ${label}`);
      }
    });

    it(`${name} has a name, a description and a markdown intro`, () => {
      assert.equal(typeof form.name, 'string');
      assert.equal(typeof form.description, 'string');
      assert.equal(form.body[0].type, 'markdown');
      assert.match(
        form.body[0].attributes.value,
        /docs\/agents\/writing-issues\.md/
      );
    });
  }

  it('feature.yml is the Feature form with the enhancement label', () => {
    assert.equal(feature.name, 'Feature');
    assert.deepEqual(feature.labels, ['enhancement']);
    assert.equal(feature.type, 'Feature');
  });

  it('bug.yml is the Bug form with the bug label', () => {
    assert.equal(bug.name, 'Bug');
    assert.deepEqual(bug.labels, ['bug']);
    assert.equal(bug.type, 'Bug');
  });

  it('feature.yml has the template fields plus the requirements input', () => {
    assert.deepEqual(ids(feature), [...FEATURE_IDS, 'requirements']);
    assert.equal(field(feature, 'requirements').type, 'input');
    assert.notEqual(field(feature, 'requirements').validations?.required, true);
  });

  it('bug.yml has the bug report fields', () => {
    assert.deepEqual(ids(bug), BUG_IDS);
  });

  for (const [name, form, required] of [
    ['feature.yml', feature, FEATURE_REQUIRED],
    ['bug.yml', bug, BUG_REQUIRED],
  ]) {
    it(`${name} requires ${required.join(', ')}`, () => {
      for (const id of required) {
        assert.ok(field(form, id), `field ${id} exists`);
        assert.equal(field(form, id).validations?.required, true, id);
      }
      for (const f of fields(form)) {
        if (!required.includes(f.id)) {
          assert.notEqual(f.validations?.required, true, `${f.id} optional`);
        }
      }
    });

    it(`${name} pre-fills acceptance criteria as checkboxes`, () => {
      assert.equal(field(form, 'acceptance').type, 'textarea');
      assert.equal(field(form, 'acceptance').attributes.value, '- [ ] ');
    });

    it(`${name} renders verify as a shell block`, () => {
      assert.equal(field(form, 'verify').attributes.render, 'shell');
    });
  }

  it('bug.yml renders logs as a code block', () => {
    assert.equal(typeof field(bug, 'logs').attributes.render, 'string');
  });

  it('feature.yml follows the roadmap template section order', () => {
    const sections = roadmapTemplateSections();
    const templateFields = fields(feature).filter((f) => f.type === 'textarea');
    assert.deepEqual(
      templateFields.map((f) => f.attributes.label),
      sections
    );
    assert.deepEqual(
      templateFields.map((f) => f.id),
      FEATURE_IDS
    );
  });

  it('config.yml keeps blank issues and links the roadmap case study', () => {
    assert.equal(config.blank_issues_enabled, true);
    assert.equal(
      config.contact_links[0].url,
      'https://github.com/link-foundation/ui/tree/main/docs/case-studies/issue-1/roadmap'
    );
    for (const link of config.contact_links) {
      assert.ok(link.name && link.url && link.about, JSON.stringify(link));
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
