// Lists export names shared by more than one ui-components subpath.
// `export *` silently drops names exported by two modules, so a collision
// would hide an export from the combined entry point.
const subpaths = ['behavior', 'a11y', 'charts', 'diagrams', 'layout', 'icons'];
const seen = new Map();
for (const sub of subpaths) {
  const mod = await import(`@link-foundation/ui-components/${sub}`);
  for (const name of Object.keys(mod)) {
    seen.set(name, [...(seen.get(name) ?? []), sub]);
  }
}
const clashes = [...seen].filter(([, subs]) => subs.length > 1);
console.log(clashes.length ? clashes : 'no collisions');
const all = await import('@link-foundation/ui-components');
console.log('combined exports:', Object.keys(all).length, 'of', seen.size);
