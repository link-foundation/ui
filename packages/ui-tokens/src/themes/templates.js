/** Open UI anatomy for the first template consumer. No executable templates. */
const PARTS = new Set(['root', 'label', 'icon', 'indicator']);
const KINDS = new Set(['box', 'text', 'icon']);

export function readTemplate(links, diagnostics) {
  const names = new Set();
  const read = (link) => {
    const [head, name, ...body] = link;
    const kind =
      body.find((item) => Array.isArray(item) && item[0] === 'kind')?.[1] ??
      'box';
    if (
      head !== 'part' ||
      !PARTS.has(name) ||
      names.has(name) ||
      !KINDS.has(kind)
    ) {
      diagnostics.push({
        code: 'unknown-part',
        severity: 'error',
        message: `Invalid template part: ${name}`,
        at: { part: name },
      });
      return null;
    }
    names.add(name);
    const children = body
      .filter((item) => Array.isArray(item) && item[0] === 'part')
      .map(read);
    return children.some((child) => child === null)
      ? null
      : { name, kind, children };
  };
  const parts = links.map(read);
  if (parts.some((p) => p === null)) {
    return null;
  }
  const root = parts.find((p) => p.name === 'root');
  if (!root || !names.has('label')) {
    diagnostics.push({
      code: 'missing-part',
      severity: 'error',
      message: 'Button templates require root and label parts',
      at: {},
    });
    return null;
  }
  // The compact syntax lists siblings after root; the root owns those parts.
  root.children.push(...parts.filter((p) => p !== root));
  return root;
}

/** Child themes win. Templates are selected when mounting; switching only changes CSS. */
export function resolveTemplate(themeChain, kind) {
  const chain = Array.isArray(themeChain) ? themeChain : [themeChain];
  for (const theme of [...chain].reverse()) {
    const template = theme?.templates.get(kind);
    if (template) {
      return template;
    }
  }
  return null;
}
