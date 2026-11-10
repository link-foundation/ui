/** Declarative conditions use schema property values already parsed by LiNo. */
export function matchesCondition(condition, values) {
  if (condition === undefined) {
    return true;
  }
  if (!Array.isArray(condition)) {
    return Boolean(values[condition]);
  }
  const [head, ...args] = condition;
  if (Array.isArray(head)) {
    return condition.every((c) => matchesCondition(c, values));
  }
  if (head === 'all') {
    return args.every((c) => matchesCondition(c, values));
  }
  if (head === 'any') {
    return args.some((c) => matchesCondition(c, values));
  }
  if (head === 'not') {
    return !matchesCondition(args.length === 1 ? args[0] : args, values);
  }
  const [expected] = args;
  return args.length
    ? String(values[head]) === String(expected)
    : Boolean(values[head]);
}

export function fieldVisible(field, values, options = {}, section) {
  const props = field.props;
  const { tab, level } = activeScope(options, section);
  return (
    matchesCondition(section?.['visible-when'], values) &&
    matchesCondition(props['visible-when'], values) &&
    (!props.tab || !tab || props.tab === tab) &&
    (!props.level || !level || props.level === level)
  );
}

function activeScope({ tabs = {}, level, sectionLevels = {} }, section) {
  return {
    tab: tabs[section?.id] ?? section?.tabs?.[0],
    level: sectionLevels[section?.id] ?? level ?? section?.levels?.[0],
  };
}
