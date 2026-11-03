import {
  defaultVocabulary,
  parseLinks,
  valueMatches,
} from '@link-foundation/ui-core';

const TYPES = ['color', 'dimension', 'duration', 'number', 'boolean'];

/** Build the target and ancestor index from the trusted site's schema. */
function schemaIndex(schema) {
  const document = schema?.document ?? schema;
  const vocabulary = schema?.vocabulary ?? defaultVocabulary();
  const parents = new Map();
  const nodes = new Map();
  const walk = (node, parent = null) => {
    nodes.set(node.id, node);
    parents.set(node.id, parent);
    node.children?.forEach((child) => walk(child, node.id));
  };
  document?.roots?.forEach((node) => walk(node));
  return { nodes, parents, vocabulary };
}

function isOverrides(roots) {
  if (roots.length !== 1) {
    return false;
  }
  const [root] = roots;
  return root && !Array.isArray(root) && root.values?.[0] === 'overrides';
}

function metadataReason(link, seen, nodes) {
  const [command, id] = link;
  if (seen.has(command) || link.length !== 2 || typeof id !== 'string') {
    return `Invalid ${command}`;
  }
  if (command === 'layer' && !['user', 'session'].includes(id)) {
    return 'Invalid layer';
  }
  if (command === 'base' && !nodes.has(id)) {
    return 'Invalid base';
  }
  seen.add(command);
  return null;
}

/** Validate untrusted links; only the returned links may be previewed. */
export function validateOverrides(text, { schema, policy = {} } = {}) {
  let roots;
  try {
    roots = parseLinks(text, { maxInputSize: 65536, maxDepth: 16 });
  } catch (error) {
    return { links: [], rejected: [{ link: null, reason: error.message }] };
  }
  if (!isOverrides(roots)) {
    return {
      links: [],
      rejected: [
        {
          link: roots[0] ?? null,
          reason: 'Expected exactly one overrides link',
        },
      ],
    };
  }
  const index = schemaIndex(schema);
  const safe = ['overrides'];
  const rejected = [];
  const seen = new Set();
  for (const link of roots[0].values.slice(1)) {
    let reason;
    if (!Array.isArray(link)) {
      reason = 'Expected a layer, base or set child';
    } else if (['layer', 'base'].includes(link[0])) {
      reason = metadataReason(link, seen, index.nodes);
    } else {
      reason = validateSet(link, index, policy);
    }
    if (reason) {
      rejected.push({ link, reason });
    } else {
      safe.push(link);
    }
  }
  return { links: [{ id: roots[0].id, values: safe }], rejected };
}

function protectionReason(id, name, rest, parents, policy) {
  for (let ancestor = id; ancestor; ancestor = parents.get(ancestor)) {
    if (policy.lockedElements?.has(ancestor)) {
      return 'Locked element';
    }
  }
  const comfort = policy.comfortKeys ?? new Set();
  if (comfort.has(name) || comfort.has(`${id}.${name}`)) {
    return 'Comfort key';
  }
  if (name === 'token' && comfort.has(rest[0])) {
    return 'Comfort key';
  }
  return null;
}

function propertyType(element, name, rest, vocabulary) {
  const kind = vocabulary.kinds.get(element.kind);
  const property = kind?.properties.get(
    name === element.kind ? kind.positional[0] : name
  );
  if (
    !property ||
    property.type === 'action' ||
    ['bind', 'machine'].includes(name)
  ) {
    return { reason: 'Unknown or non-data property' };
  }
  if (name !== 'token') {
    return { type: property.type, values: rest };
  }
  const [key, ...values] = rest;
  const token = element.properties.find(
    (p) => p.name === 'token' && p.values[0] === key
  );
  if (!token) {
    return { reason: 'Unknown token' };
  }
  // The dialect declares tokens as any; use the existing scalar's type.
  const type = TYPES.find((t) => valueMatches(t, token.values[1])) ?? 'string';
  return { type, values };
}

function scalarReason(type, values) {
  if (
    values.length !== 1 ||
    typeof values[0] !== 'string' ||
    type === 'any' ||
    !valueMatches(type, values[0])
  ) {
    return 'Wrong value type';
  }
  const unsafe = ['javascript:', 'data:', 'vbscript:'];
  if (
    ['url', 'element-ref-or-url'].includes(type) &&
    unsafe.some((scheme) => values[0].trim().toLowerCase().startsWith(scheme))
  ) {
    return 'Unsafe URL';
  }
  return null;
}

function validateSet(link, { nodes, parents, vocabulary }, policy) {
  const [command, id, name, ...rest] = link;
  if (command !== 'set' || name === 'on') {
    return 'Only data set links are allowed; actions are forbidden';
  }
  const element = nodes.get(id);
  if (!element) {
    return 'Unknown element';
  }
  const protectedKey = protectionReason(id, name, rest, parents, policy);
  if (protectedKey) {
    return protectedKey;
  }
  const { type, values, reason } = propertyType(
    element,
    name,
    rest,
    vocabulary
  );
  return reason ?? scalarReason(type, values);
}
