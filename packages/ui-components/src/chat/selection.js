/** Context target and multi-selection are deliberately independent. */
export function createChatSelection() {
  const selected = new Set();
  let target = null;
  let anchor = null;
  return {
    state: () => ({ selected: new Set(selected), target, anchor }),
    target(id) {
      target = id;
    },
    select(id, { toggle = false, range = false, keys = [] } = {}) {
      if (range && anchor !== null && keys.includes(anchor)) {
        const ends = [keys.indexOf(anchor), keys.indexOf(id)].sort(
          (a, b) => a - b
        );
        if (ends[0] < 0) {
          return;
        }
        selected.clear();
        keys.slice(ends[0], ends[1] + 1).forEach((key) => selected.add(key));
      } else {
        if (!toggle) {
          selected.clear();
        }
        if (toggle && selected.has(id)) {
          selected.delete(id);
        } else {
          selected.add(id);
        }
        anchor = id;
      }
    },
    clear() {
      selected.clear();
      target = null;
      anchor = null;
    },
  };
}
