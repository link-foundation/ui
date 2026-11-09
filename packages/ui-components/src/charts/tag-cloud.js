/** A semantic tag cloud; its configuration and items round-trip through LiNo. */
import { fail } from './errors.js';
import { headName, isAtom, prop } from './lino.js';
import { booleanOf, optionalNumber, optionalText, properties } from './read.js';
import { escapeXml } from './svg.js';

export function readTagCloud(node, path) {
  const props = properties(node, path, 1, [
    'label',
    'description',
    'min-size',
    'max-size',
    'items',
  ]);
  const minSize = optionalNumber(props, 'min-size', 12);
  const maxSize = optionalNumber(props, 'max-size', 36);
  if (minSize <= 0 || maxSize < minSize) {
    fail(
      'invalid-value',
      'tag sizes require 0 < min-size <= max-size',
      node,
      path
    );
  }
  const itemsEntry = props.get('items')?.[0];
  if (!itemsEntry) {
    fail('missing-field', 'tag-cloud requires items', node, path);
  }
  const items = itemsEntry.node.values.slice(1).map((item, i) => {
    const at = [...itemsEntry.path, i + 1];
    if (headName(item) !== 'item' || !isAtom(item.values[1])) {
      fail('invalid-value', 'expected item NAME', item, at);
    }
    const fields = properties(item, at, 2, ['count', 'color', 'emphasis']);
    const count = optionalNumber(fields, 'count');
    if (count !== null && count < 0) {
      fail('invalid-value', 'count must be nonnegative', item, at);
    }
    const emphasis = fields.get('emphasis')?.[0];
    return {
      name: item.values[1].id,
      count,
      color: optionalText(fields, 'color'),
      emphasis: emphasis
        ? booleanOf(emphasis.node, emphasis.path, 'emphasis')
        : false,
    };
  });
  return {
    kind: 'tag-cloud',
    id: node.id,
    label: optionalText(props, 'label'),
    description: optionalText(props, 'description'),
    minSize,
    maxSize,
    items,
  };
}

export function tagCloudNode(spec) {
  return {
    id: spec.id ?? null,
    values: [
      { id: 'tag-cloud', values: [] },
      ...['label', 'description'].flatMap((name) =>
        spec[name] === null || spec[name] === undefined
          ? []
          : [prop(name, spec[name])]
      ),
      prop('min-size', String(spec.minSize ?? 12)),
      prop('max-size', String(spec.maxSize ?? 36)),
      prop(
        'items',
        ...spec.items.map((item) =>
          prop(
            'item',
            item.name,
            ...(item.count === null || item.count === undefined
              ? []
              : [prop('count', String(item.count))]),
            ...(item.color ? [prop('color', item.color)] : []),
            ...(item.emphasis ? [prop('emphasis', 'true')] : [])
          )
        )
      ),
    ],
  };
}

export function tagSizes(spec) {
  const max = Math.max(1, ...spec.items.map((item) => item.count ?? 0));
  return spec.items.map(
    (item) =>
      (spec.minSize ?? 12) +
      (((spec.maxSize ?? 36) - (spec.minSize ?? 12)) *
        Math.log1p(item.count ?? 0)) /
        Math.log1p(max)
  );
}

export function drawTagCloud(document, spec) {
  const list = document.createElement('ul');
  list.className = 'ui-tag-cloud';
  list.setAttribute('aria-label', spec.description ?? spec.label ?? 'Tags');
  const sizes = tagSizes(spec);
  spec.items.forEach((item, i) => {
    const li = document.createElement('li');
    li.textContent = `${item.emphasis ? '★ ' : ''}${item.name}`;
    li.setAttribute(
      'aria-label',
      `${item.name}, ${item.count ?? 0}${item.emphasis ? ', emphasized' : ''}`
    );
    li.style.fontSize = `${sizes[i]}px`;
    if (item.color) {
      li.style.color = item.color;
    }
    if (item.emphasis) {
      li.style.fontWeight = 'bold';
    }
    list.append(li);
  });
  return list;
}

/** SVG export keeps the counts in each item's title. DOM rendering is a list. */
export function tagCloudSvg(spec) {
  const sizes = tagSizes(spec);
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(spec.description ?? spec.label ?? 'Tags')}" width="640" height="${Math.max(40, spec.items.length * 44)}">${spec.items.map((item, i) => `<text x="8" y="${(i + 1) * 44 - 8}" font-size="${sizes[i]}" fill="${escapeXml(item.color ?? 'currentColor')}"><title>${escapeXml(item.name)}, ${item.count ?? 0}</title>${item.emphasis ? '★ ' : ''}${escapeXml(item.name)}</text>`).join('')}</svg>`;
}
