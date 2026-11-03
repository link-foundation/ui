/** Three-state sort cycle; stable ordering also on runtimes with older sort implementations. */
export function nextSort(current, column) {
  return {
    column,
    direction:
      current?.column !== column || current.direction === 'none'
        ? 'ascending'
        : current.direction === 'ascending'
          ? 'descending'
          : 'none',
  };
}

export function sortItems(items, { column, direction = 'none' } = {}, compare) {
  if (direction === 'none') {
    return [...items];
  }
  const comparator =
    compare ??
    ((a, b) => {
      const left = a[column];
      const right = b[column];
      if (left === right) {
        return 0;
      }
      if (left === null || left === undefined) {
        return -1;
      }
      if (right === null || right === undefined) {
        return 1;
      }
      return left < right ? -1 : 1;
    });
  return items
    .map((item, index) => ({ item, index }))
    .sort(
      (a, b) =>
        (direction === 'descending' ? -1 : 1) * comparator(a.item, b.item) ||
        a.index - b.index
    )
    .map(({ item }) => item);
}
