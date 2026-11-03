import { formatLinks, parseLinks } from '@link-foundation/ui-core';
import { readPatch } from '@link-foundation/ui-config';

/** Export only writable-layer changes relative to site, in stable ID/property order. */
export function exportOverrides(
  config,
  { id = 'user-overrides', base, layers = ['user', 'session'] } = {}
) {
  if (layers.some((layer) => !['user', 'session'].includes(layer))) {
    throw new Error('Only user and session overrides can be exported');
  }
  const exported = config.exportPatch({ layers, against: 'site', base });
  const patch = readPatch(exported, {
    maxSize: exported.length * 3,
    maxOps: Number.MAX_SAFE_INTEGER,
  });
  if (patch.diagnostics.some((d) => d.severity === 'error')) {
    throw new Error(patch.diagnostics.map((d) => d.message).join('; '));
  }
  const compare = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
  patch.ops.sort(
    (a, b) =>
      compare(a.id, b.id) ||
      compare(a.name, b.name) ||
      compare(a.key ?? '', b.key ?? '')
  );
  const links = [
    {
      id,
      values: [
        'overrides',
        ['layer', 'user'],
        ...(patch.base ? [['base', patch.base]] : []),
        ...patch.ops.map((op) => [
          'set',
          op.id,
          op.name,
          ...(op.key === null ? [] : [op.key]),
          ...op.values,
        ]),
      ],
    },
  ];
  const text = formatLinks(links);
  return {
    text,
    links: parseLinks(text, { maxInputSize: text.length }),
    count: patch.ops.length,
  };
}
