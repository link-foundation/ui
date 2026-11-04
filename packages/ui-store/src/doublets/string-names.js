/** Escape document strings that the links query name namespace reserves. */
const PREFIX = '!';
export function storedName(text) {
  return text === '' ||
    text === '*' ||
    text.startsWith('$') ||
    text.startsWith(PREFIX) ||
    /^[0-9]+$/.test(text)
    ? PREFIX + text
    : text;
}
export function documentString(name) {
  return name?.startsWith(PREFIX) ? name.slice(PREFIX.length) : name;
}

/** Combine a seed sidecar with the client's live names. */
export function bindingNames(links, fallback) {
  const names = links.names ?? (fallback?.getName ? fallback : null);
  if (!names) {
    return fallback;
  }
  return {
    entriesById: () => [
      ...(fallback === names
        ? []
        : fallback?.getName
          ? fallback.entries().map(([id, text]) => [id, documentString(text)])
          : [...(fallback ?? [])].map(([text, id]) => [
              links.resolve?.(id) ?? id,
              text,
            ])),
      ...names.entries().map(([id, text]) => [id, documentString(text)]),
    ],
    getByName: (text) =>
      names.getByName(storedName(text)) ?? fallback?.get?.(text),
    setName: (id, text) => names.setName(id, storedName(text)),
  };
}
