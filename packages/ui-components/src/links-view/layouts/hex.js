import { regular } from './regular.js';
export function hex(network, options = {}) {
  return regular(network, options, (i, n) => {
    const columns = Math.ceil(Math.sqrt(n));
    const row = Math.floor(i / columns);
    return { x: (i % columns) + (row % 2) / 2, y: (row * Math.sqrt(3)) / 2 };
  });
}
