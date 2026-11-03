/** Redact values, while retaining field definitions and structural operations. */
export function sensitiveNode(node) {
  return (
    node?.properties?.some(
      (p) =>
        (p.name === 'type' && p.values[0] === 'password') ||
        (p.name === 'sensitive' && p.values[0] === 'true')
    ) ?? false
  );
}
export function sensitiveTarget(target) {
  const boundary = target?.closest?.(
    '[sensitive="true"], [data-sensitive="true"], [type="password"]'
  );
  return target?.type === 'password' || Boolean(boundary);
}
export function redactNode(node, inherited = false) {
  const sensitive = inherited || sensitiveNode(node);
  return {
    ...node,
    positional: sensitive ? node.positional.map(() => '***') : node.positional,
    properties: node.properties.map((p) =>
      sensitive && !['type', 'sensitive'].includes(p.name)
        ? { ...p, values: ['***'] }
        : p
    ),
    unknown: sensitive ? [] : node.unknown,
    children: node.children.map((child) => redactNode(child, sensitive)),
  };
}
export function redactOperation(op, sensitive) {
  if (op.op === 'insert') {
    return { ...op, node: redactNode(op.node, sensitive) };
  }
  if (
    sensitive &&
    ['setProp', 'setPositional'].includes(op.op) &&
    !['type', 'sensitive'].includes(op.name)
  ) {
    return { ...op, values: ['***'] };
  }
  return op;
}
