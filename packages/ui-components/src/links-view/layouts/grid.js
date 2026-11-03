import { regular } from './regular.js';
export function grid(network, options = {}) {
  return regular(network, options, (i, n) => {
    const columns = Math.ceil(Math.sqrt(n));
    return { x: i % columns, y: Math.floor(i / columns) };
  });
}
