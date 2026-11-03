// Every subpath re-exported by the ui-components root must not share an
// export name with another (an `export *` clash silently drops the name).
// Usage: node experiments/issue-36-export-collisions.mjs
const subpaths = ['behavior', 'a11y', 'diagrams', 'layout'];
const owners = new Map();
for (const sub of subpaths) {
  const mod = await import(`../packages/ui-components/src/${sub}/index.js`);
  for (const name of Object.keys(mod)) {
    owners.set(name, [...(owners.get(name) ?? []), sub]);
  }
}
const clashes = [...owners].filter(([, subs]) => subs.length > 1);
console.log(clashes.length === 0 ? 'no clashes' : clashes);
const root = await import('../packages/ui-components/src/index.js');
console.log('root exports', Object.keys(root).length, 'of', owners.size);
