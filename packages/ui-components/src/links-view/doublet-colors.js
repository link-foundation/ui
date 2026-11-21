// Named palettes accepted by shared doublet URLs. A link override wins over
// its palette entry, and palettes repeat for networks longer than one cycle.
const paletteColors = Object.freeze({
  site: '#22d3ee #c084fc #f472b6 #facc15 #34d399 #fb923c #60a5fa #f87171 #a3e635',
  print:
    '#0e7490 #9333ea #db2777 #b45309 #047857 #c2410c #1d4ed8 #b91c1c #4d7c0f',
  neon: '#00f0ff #ff00e6 #faff00 #00ff85 #ff6b00 #8a5cff #ff2d55 #00b3ff #c6ff00',
  pastel:
    '#93c5fd #c4b5fd #f9a8d4 #fde68a #a7f3d0 #fed7aa #bae6fd #fecaca #d9f99d',
  warm: '#f97316 #ef4444 #eab308 #f43f5e #fb923c #facc15 #dc2626 #fbbf24 #e11d48',
  cold: '#06b6d4 #3b82f6 #8b5cf6 #14b8a6 #0ea5e9 #6366f1 #22d3ee #a78bfa #2dd4bf',
});
export const doubletPalettes = Object.freeze(
  ['default', 'custom', 'mono', 'inherit'].concat(Object.keys(paletteColors))
);
const colors = Object.freeze(
  Object.fromEntries(
    Object.entries(paletteColors).map(([name, list]) => [
      name,
      Object.freeze(list.split(' ')),
    ])
  )
);

export function doubletColor(options, id, override) {
  const palette = colors[options.palette];
  return (
    override ??
    (palette
      ? palette[(id - 1) % palette.length]
      : options.palette === 'inherit'
        ? 'currentColor'
        : options.color)
  );
}
