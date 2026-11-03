import { regular } from './regular.js';
export function circle(network, options = {}) {
  return regular(network, options, (i, n) => ({
    x: Math.cos((i * 2 * Math.PI) / n - Math.PI / 2),
    y: Math.sin((i * 2 * Math.PI) / n - Math.PI / 2),
  }));
}
