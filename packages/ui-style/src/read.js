/**
 * `readStyles(text)`: style rules written in Links Notation.
 *
 * ```lino
 * (card-style: style
 *   (selector (type card) (within (type dialog)))
 *   (padding (token space.medium))
 *   (media (max-width 640px)
 *     (padding (token space.small)))
 *   (container (min-width 400px)
 *     (direction horizontal))
 *   (state disabled (opacity 0.38)))
 * ```
 *
 * The text is read by ui-core `parse` (the official `links-notation` parser
 * plus path folding). A rule is a `style` element of the ui-dialect
 * vocabulary; this reader gives `style` every property of the style
 * vocabulary (src/properties.js) plus `container`, all multi-valued so that
 * the source order of declarations is kept.
 *
 * CSS syntax cannot be written in bare values: `:` separates an id from a
 * link, so `(state :hover)` or `(media (max-width: 640px))` reads as a link
 * with an id. Such links, and any atom with a `:`, are reported as
 * `css-syntax` errors and skipped, never silently accepted.
 */

import { defaultVocabulary, parse, walk } from '@link-foundation/ui-core';
import { styleDiagnostic } from './diagnostics.js';
import {
  PROPERTIES,
  isStyleProperty,
  rawText,
  typeDeclaration,
} from './properties.js';
import { STATES, readConditions } from './conditions.js';

/**
 * @typedef {import('./types.js').StyleRule} StyleRule
 * @typedef {import('./types.js').Selector} Selector
 * @typedef {import('./types.js').RawValue} RawValue
 * @typedef {import('./types.js').Diagnostic} Diagnostic
 */

const BLOCKS = ['selector', 'state', 'media', 'container'];

/** Whether a head starts a declaration or a block. */
const isBodyItem = (name) => BLOCKS.includes(name) || isStyleProperty(name);

let vocabulary;

/** The ui-dialect vocabulary whose `style` kind has every style property. */
function styleVocabulary() {
  if (vocabulary === undefined) {
    const base = defaultVocabulary();
    const style = base.kinds.get('style');
    const names = [...BLOCKS, ...Object.keys(PROPERTIES)];
    const properties = new Map(
      names.map((name) => [name, { type: 'any', multi: true }])
    );
    vocabulary = {
      ...base,
      kinds: new Map(base.kinds).set('style', { ...style, properties }),
      multiValued: new Set([...base.multiValued, ...names]),
    };
  }
  return vocabulary;
}

/** ui-core codes that this reader reports in its own terms. */
const RESTATED = new Set([
  'unknown-sublink',
  'unexpected-child',
  'unknown-kind',
]);

/**
 * The first piece of CSS syntax in a raw value: an atom with `:` or a link
 * with an id (`(max-width: 640px)` reads as the id `max-width`).
 * @param {RawValue} raw
 * @returns {string|null}
 */
export function findCssSyntax(raw) {
  if (typeof raw === 'string') {
    return raw.includes(':') ? raw : null;
  }
  if (!Array.isArray(raw)) {
    return `${raw.id}:`;
  }
  for (const value of raw) {
    const found = findCssSyntax(value);
    if (found !== null) {
      return found;
    }
  }
  return null;
}

const isAtomPair = (part) =>
  Array.isArray(part) &&
  part.length === 2 &&
  typeof part[0] === 'string' &&
  typeof part[1] === 'string';

/**
 * Read the parts of a selector: `(type KIND)`, `(id ID)`, `(PROP VALUE)`
 * and `(within PART...)`.
 * @returns {Selector|null}
 */
function readSelector(parts, at, diagnostics) {
  /** @type {Selector} */
  const selector = { type: null, id: null, props: [], within: [] };
  const invalid = (part) => {
    diagnostics.push(
      styleDiagnostic('invalid-selector', 'error', {
        ...at,
        text: rawText(part),
      })
    );
    return null;
  };
  for (const part of parts) {
    if (Array.isArray(part) && part[0] === 'within' && part.length > 1) {
      const ancestor = readSelector(part.slice(1), at, diagnostics);
      if (ancestor === null) {
        return null;
      }
      selector.within.push(ancestor);
    } else if (!isAtomPair(part)) {
      return invalid(part);
    } else if (part[0] === 'type' || part[0] === 'id') {
      if (selector[part[0]] !== null) {
        return invalid(part);
      }
      selector[part[0]] = part[1];
    } else {
      selector.props.push({ name: part[0], value: part[1] });
    }
  }
  return parts.length === 0 ? invalid([]) : selector;
}

/**
 * Read the body of a rule or a block: declarations, `state`, `media` and
 * `container` blocks (any nesting), and at the top level the selector.
 * @param {RawValue[]} items  each item a `(NAME VALUE...)` link
 * @param {StyleRule} rule  the rule to fill
 * @param {{ at: Record<string, any>, diagnostics: Diagnostic[], top: boolean,
 *   selectors: Selector[] }} ctx
 */
function readBody(items, rule, ctx) {
  const { at, diagnostics } = ctx;
  for (const item of items) {
    const css = findCssSyntax(item);
    if (css !== null) {
      diagnostics.push(
        styleDiagnostic('css-syntax', 'error', { ...at, text: css })
      );
      continue;
    }
    if (!Array.isArray(item) || typeof item[0] !== 'string') {
      diagnostics.push(
        styleDiagnostic('unexpected-value', 'error', {
          ...at,
          text: rawText(item),
        })
      );
      continue;
    }
    const [name, ...rest] = item;
    if (name === 'selector') {
      readSelectorItem(rest, ctx);
    } else if (name === 'state') {
      readState(rest, rule, ctx);
    } else if (name === 'media' || name === 'container') {
      readCondition(name, rest, rule, ctx);
    } else if (isStyleProperty(name)) {
      const decl = typeDeclaration(name, rest, at, diagnostics);
      if (decl !== null) {
        rule.declarations.push(decl);
      }
    } else {
      diagnostics.push(
        styleDiagnostic('unknown-property', 'error', { ...at, property: name })
      );
    }
  }
}

function readSelectorItem(parts, ctx) {
  if (!ctx.top) {
    ctx.diagnostics.push(
      styleDiagnostic('misplaced-selector', 'error', ctx.at)
    );
    return;
  }
  const selector = readSelector(parts, ctx.at, ctx.diagnostics);
  if (selector !== null) {
    ctx.selectors.push(selector);
  }
}

/** An empty rule for a block of `rule`: same id, order and selector. */
const blockRule = (rule) => ({
  id: rule.id,
  order: rule.order,
  selector: rule.selector,
  declarations: [],
  blocks: [],
});

function readState([name, ...body], rule, ctx) {
  if (typeof name !== 'string' || !STATES.includes(name)) {
    ctx.diagnostics.push(
      styleDiagnostic('unknown-state', 'error', {
        ...ctx.at,
        text: name === undefined ? '' : rawText(name),
      })
    );
    return;
  }
  const inner = blockRule(rule);
  readBody(body, inner, { ...ctx, top: false, at: { ...ctx.at, state: name } });
  rule.blocks.push({ kind: 'state', condition: name, rule: inner });
}

function readCondition(kind, values, rule, ctx) {
  const { conditions, body } = readConditions(
    kind,
    values,
    ctx.at,
    ctx.diagnostics,
    isBodyItem
  );
  if (conditions === null) {
    return;
  }
  const inner = blockRule(rule);
  readBody(body, inner, { ...ctx, top: false });
  rule.blocks.push({ kind, condition: conditions, rule: inner });
}

/**
 * Read one `style` element into a rule, or `null` when it has no selector.
 * @param {import('./types.js').UiNode} node
 * @param {number} order
 * @param {Diagnostic[]} diagnostics
 * @returns {StyleRule|null}
 */
function readRule(node, order, diagnostics) {
  const id = node.id ?? `style-${order + 1}`;
  const at = { rule: id };
  if (node.id === null) {
    diagnostics.push(styleDiagnostic('anonymous-rule', 'warning', at));
  }
  /** @type {StyleRule} */
  const rule = { id, order, selector: null, declarations: [], blocks: [] };
  const selectors = [];
  // Positional values, unknown sublinks and children (a `(state :hover)`
  // reads as a child element with the id `state`) go through readBody too.
  const items = [
    ...node.positional,
    ...node.properties.map((p) => [p.name, ...p.values]),
    ...node.unknown,
    ...node.children.map((child) =>
      child.id === null ? [child.kind ?? ''] : { id: child.id, values: [] }
    ),
  ];
  readBody(items, rule, { at, diagnostics, top: true, selectors });
  if (selectors.length > 1) {
    diagnostics.push(styleDiagnostic('duplicate-selector', 'warning', at));
  }
  if (selectors.length === 0) {
    diagnostics.push(styleDiagnostic('missing-selector', 'error', at));
    return null;
  }
  const selector = selectors[selectors.length - 1];
  setSelector(rule, selector);
  return rule;
}

/** Give a rule and all its blocks the selector. */
function setSelector(rule, selector) {
  rule.selector = selector;
  for (const block of rule.blocks) {
    setSelector(block.rule, selector);
  }
}

/**
 * Read every style rule (`style` element) of a Links Notation text. Other
 * elements (themes, documents) are skipped.
 * @param {string} text
 * @returns {{ rules: StyleRule[], diagnostics: Diagnostic[] }}
 */
export function readStyles(text) {
  const doc = parse(text, { vocabulary: styleVocabulary(), checks: false });
  const diagnostics = doc.diagnostics.filter((d) => !RESTATED.has(d.code));
  /** @type {StyleRule[]} */
  const rules = [];
  let order = 0;
  walk(doc, (node) => {
    if (node.kind !== 'style') {
      return undefined;
    }
    const rule = readRule(node, order, diagnostics);
    order += 1;
    if (rule !== null) {
      rules.push(rule);
    }
    return false;
  });
  return { rules, diagnostics };
}
