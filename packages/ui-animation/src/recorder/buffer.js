/** Fixed-capacity ring; replacing adjacent field edits never reorders other events. */
export function createEventBuffer(capacity) {
  if (!Number.isSafeInteger(capacity) || capacity < 1) {
    throw new RangeError('maxEvents must be a positive integer');
  }
  const events = [];
  let offset = 0;
  let count = 0;
  let truncated = false;
  return {
    append(event) {
      const previous = count ? events[(offset + count - 1) % capacity] : null;
      if (
        event.kind === 'input' &&
        event.args[0] === 'text' &&
        previous?.kind === 'input' &&
        previous.args[0] === 'text' &&
        previous.args[1] === event.args[1]
      ) {
        events[(offset + count - 1) % capacity] = event;
        return;
      }
      if (count === capacity) {
        offset = (offset + 1) % capacity;
        truncated = true;
        count--;
      }
      events[(offset + count) % capacity] = event;
      count++;
    },
    get size() {
      return count;
    },
    get truncated() {
      return truncated;
    },
    values: () =>
      Array.from({ length: count }, (_, i) => events[(offset + i) % capacity]),
  };
}
