import { regular } from './regular.js';
export function spiral(network, options = {}) {
  return regular(network, options, (i) => {
    const angle = i * Math.PI * (3 - Math.sqrt(5));
    return {
      x: Math.sqrt(i) * Math.cos(angle),
      y: Math.sqrt(i) * Math.sin(angle),
    };
  });
}
