/** Theme-specific spring metadata is separate from DTCG primitive tokens. */
export function isSpringToken(args) {
  return (
    typeof args[0] === 'string' &&
    args[0].startsWith('motion.spring.') &&
    Array.isArray(args[1]) &&
    args[1][0] === 'spring'
  );
}

export function readSpring(args) {
  const fields = args[1].slice(1);
  if (
    args.length !== 2 ||
    fields.length !== 2 ||
    !fields.every((field) => Array.isArray(field) && field.length === 2) ||
    new Set(fields.map((field) => field[0])).size !== 2
  ) {
    return null;
  }
  const { response, damping } = Object.fromEntries(fields);
  const seconds =
    typeof response === 'string' && response.endsWith('s')
      ? Number(response.slice(0, -1))
      : NaN;
  const ratio = Number(damping);
  const name = args[0].slice('motion.spring.'.length);
  return /^[a-z][a-z0-9-]*$/u.test(name) &&
    seconds > 0 &&
    seconds <= 10 &&
    ratio > 0 &&
    ratio < 1
    ? { name, value: { response: seconds, damping: ratio } }
    : null;
}
