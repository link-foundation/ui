/**
 * Stories and the control catalog.
 *
 * A story file (`stories/<kind>.lino`) names its component and holds one
 * `story` per example, each an element without an ID:
 *
 *   (button-stories: stories
 *     (component button)
 *     (story filled (button 'Save' (variant filled)))
 *     (story disabled (button 'Save' (disabled true))))
 *
 * Child elements of a story (radios, options) keep their IDs. The catalog
 * (`src/controls/catalog.lino`) has one entry per control:
 *
 *   (button: control (title 'Button') (stories button-stories) (apg button))
 *
 * `storiesDocument(sets)` writes every story as one document, the gallery
 * of `e2e/pages/controls.html`.
 */

import { projectLinks } from '@link-foundation/ui-core';
import { Link, Parser } from 'links-notation';

/** A bootstrap kind whose properties hold any values (`*`: multi). */
const kindSpec = (names) => ({
  positional: [],
  children: 'any',
  properties: new Map(
    names.map((name) => {
      const multi = name.endsWith('*');
      return [multi ? name.slice(0, -1) : name, { type: 'any', multi }];
    })
  ),
});

const BOOTSTRAP = Object.freeze({
  version: null,
  kinds: new Map([
    ['stories', kindSpec(['component', 'description', 'story*'])],
    ['control', kindSpec(['title', 'stories', 'apg', 'description'])],
  ]),
  actions: new Map(),
  multiValued: new Set(),
});

/** Project a LiNo file of bootstrap elements; throws on a diagnostic. */
function project(text, what) {
  const { roots, diagnostics } = projectLinks(
    new Parser().parse(text),
    BOOTSTRAP
  );
  if (diagnostics.length > 0) {
    throw new Error(
      `Invalid ${what}: ${diagnostics.map((d) => d.message).join('; ')}`
    );
  }
  return roots;
}

/** The single atom of a property, or `null`. */
const atomOf = (element, name) => {
  const values = element.properties.find((p) => p.name === name)?.values;
  return typeof values?.[0] === 'string' ? values[0] : null;
};

/**
 * Read a story file.
 * @param {string} text
 * @returns {{id: string, component: string,
 *   stories: {name: string, element: unknown[]}[]}}
 */
export function parseStories(text) {
  const roots = project(text, 'stories');
  if (roots.length !== 1 || roots[0].kind !== 'stories') {
    throw new Error('A story file holds one `stories` element');
  }
  const [root] = roots;
  const component = atomOf(root, 'component');
  if (component === null) {
    throw new Error(`${root.id}: no (component KIND)`);
  }
  const stories = root.properties
    .filter((p) => p.name === 'story')
    .map(({ values: [name, element] }) => {
      if (typeof name !== 'string' || !Array.isArray(element)) {
        throw new Error(`${root.id}: a story is (story NAME (KIND ...))`);
      }
      return Object.freeze({ name, element: Object.freeze(element) });
    });
  return Object.freeze({
    id: root.id,
    component,
    stories: Object.freeze(stories),
  });
}

/**
 * Read the control catalog.
 * @param {string} text
 * @returns {Map<string, {title: string|null, stories: string|null,
 *   apg: string|null}>}  the entries by kind name, in file order
 */
export function parseCatalog(text) {
  const entries = new Map();
  for (const element of project(text, 'catalog')) {
    if (element.kind !== 'control') {
      throw new Error(`${element.id}: a catalog entry is a \`control\``);
    }
    entries.set(
      element.id,
      Object.freeze({
        title: atomOf(element, 'title'),
        stories: atomOf(element, 'stories'),
        apg: atomOf(element, 'apg'),
      })
    );
  }
  return entries;
}

/** One value of a story element as Links Notation. */
const linkOf = (value) =>
  Array.isArray(value)
    ? new Link(null, value.map(linkOf))
    : new Link(String(value));

const isChild = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/**
 * The lines of an element: `(ID: KIND values...)` with every child element
 * on its own indented line. Child IDs get the `prefix` so the stories of
 * one document never share an ID.
 */
function elementLines(id, [kind, ...values], prefix, indent) {
  const head = values.filter((v) => !isChild(v)).map(linkOf);
  const children = values.filter(isChild);
  const text = new Link(id, [new Link(kind), ...head]).format();
  if (children.length === 0) {
    return [`${indent}${text}`];
  }
  return [
    `${indent}${text.slice(0, -1)}`,
    ...children.flatMap((child, i) => {
      const lines = elementLines(
        `${prefix}-${child.id}`,
        child.values,
        prefix,
        `${indent}  `
      );
      return i === children.length - 1
        ? [...lines.slice(0, -1), `${lines.at(-1)})`]
        : lines;
    }),
  ];
}

/** The document ID of a story: `<component>-<story>`. */
export const storyId = (component, name) => `${component}-${name}`;

/**
 * Every story of the story sets as one document (`(ID: document ...)`),
 * one element per story with the ID `<component>-<story>`.
 * @param {ReturnType<typeof parseStories>[]} sets
 * @param {{id?: string}} [options]
 */
export function storiesDocument(sets, options = {}) {
  const lines = sets.flatMap((set) =>
    set.stories.flatMap((story) => {
      const id = storyId(set.component, story.name);
      return elementLines(id, story.element, id, '  ');
    })
  );
  return `(${options.id ?? 'stories'}: document\n${lines.join('\n')})`;
}
