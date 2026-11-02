/**
 * The mapping table from HTML to dialect kinds, kept as data.
 *
 * A rule matches by tag (`tags`), optionally by the `type` attribute of an
 * `input` (`types`, missing type = `text`) or by a required attribute
 * (`requires`). It gives:
 *
 * - `kind`: the dialect kind (names from docs/spec/vocabulary.lino, #11);
 * - `text`: where the text content goes: `'positional'` or a property name;
 * - `attrs`: attributes that become properties (`src` -> `source`), used
 *   only when the value matches the property type of the vocabulary;
 * - `tag`: the HTML tag the kind stands for; any other tag is kept as
 *   `(tag ...)`, so the import stays lossless;
 * - `level`: the heading level.
 *
 * A rule is used only when the vocabulary has its kind. Kinds that #11 does
 * not define yet (`link`, `checkbox`, `text-field`, `text-area`, `list`)
 * stay in the table and fall back to `html` until the vocabulary has them.
 * Elements that match no rule use the `html` fallback.
 */

export const HTML_FALLBACK_KIND = 'html';

const heading = (level) => ({
  tags: [`h${level}`],
  kind: 'text',
  text: 'positional',
  tag: `h${level}`,
  level,
});

/** @type {readonly MappingRule[]} */
export const HTML_MAPPING = Object.freeze([
  { tags: ['button'], kind: 'button', text: 'label', tag: 'button' },
  {
    tags: ['input'],
    types: ['button', 'submit', 'reset'],
    kind: 'button',
    attrs: { value: 'label' },
    tag: 'button',
  },
  {
    tags: ['a'],
    requires: 'href',
    kind: 'link',
    text: 'label',
    attrs: { href: 'href' },
    tag: 'a',
  },
  { tags: ['p', 'span', 'label'], kind: 'text', text: 'positional' },
  ...[1, 2, 3, 4, 5, 6].map(heading),
  {
    tags: ['img'],
    kind: 'image',
    attrs: { src: 'source', alt: 'alt' },
    tag: 'img',
  },
  { tags: ['input'], types: ['checkbox'], kind: 'checkbox', tag: 'input' },
  { tags: ['input'], types: ['text'], kind: 'text-field', tag: 'input' },
  { tags: ['textarea'], kind: 'text-area', text: 'value', tag: 'textarea' },
  { tags: ['ul', 'ol'], kind: 'list' },
]);

/**
 * @typedef {{
 *   tags: string[],
 *   types?: string[],
 *   requires?: string,
 *   kind: string,
 *   text?: string,
 *   attrs?: Record<string, string>,
 *   tag?: string,
 *   level?: number,
 * }} MappingRule
 */

const inputType = (node) =>
  (node.attrs.find(([name]) => name === 'type')?.[1] ?? 'text')
    .trim()
    .toLowerCase();

/**
 * Whether a rule matches an element of the intermediate form.
 * @param {MappingRule} rule
 * @param {import('./tree.js').HtmlNode} node
 */
export const ruleMatches = (rule, node) =>
  rule.tags.includes(node.tag) &&
  (!rule.types || rule.types.includes(inputType(node))) &&
  (!rule.requires || node.attrs.some(([name]) => name === rule.requires));

/**
 * The first rule of `table` that matches `node` and whose kind is in the
 * vocabulary, or `undefined`.
 * @param {import('./tree.js').HtmlNode} node
 * @param {{ kinds: Map<string, unknown> }} vocabulary
 * @param {readonly MappingRule[]} [table]
 */
export const findRule = (node, vocabulary, table = HTML_MAPPING) =>
  table.find(
    (rule) => vocabulary.kinds.has(rule.kind) && ruleMatches(rule, node)
  );
