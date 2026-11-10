// Summarise a V8 .cpuprofile: self time per function (top N) and inclusive.
import { readFileSync } from 'node:fs';
const [file, n = '25'] = process.argv.slice(2);
const p = JSON.parse(readFileSync(file, 'utf8'));
const dt = new Map();
for (let i = 0; i < p.samples.length; i++) {
  dt.set(p.samples[i], (dt.get(p.samples[i]) ?? 0) + (p.timeDeltas[i] ?? 0));
}
const byId = new Map(p.nodes.map((x) => [x.id, x]));
const parent = new Map();
for (const x of p.nodes) {
  for (const c of x.children ?? []) {
    parent.set(c, x.id);
  }
}
const key = (x) =>
  `${x.callFrame.functionName || '(anon)'} ${x.callFrame.url.split('/').slice(-2).join('/')}:${x.callFrame.lineNumber + 1}`;
const self = new Map(),
  incl = new Map();
for (const [id, t] of dt) {
  self.set(key(byId.get(id)), (self.get(key(byId.get(id))) ?? 0) + t);
  const seen = new Set();
  for (let at = id; at !== undefined; at = parent.get(at)) {
    const k = key(byId.get(at));
    if (!seen.has(k)) {
      seen.add(k);
      incl.set(k, (incl.get(k) ?? 0) + t);
    }
  }
}
const show = (m, title) => {
  console.log(`== ${title}`);
  [...m]
    .sort((a, b) => b[1] - a[1])
    .slice(0, +n)
    .forEach(([k, t]) =>
      console.log((t / 1000).toFixed(0).padStart(8), 'ms', k)
    );
};
show(self, 'self');
show(incl, 'inclusive');
