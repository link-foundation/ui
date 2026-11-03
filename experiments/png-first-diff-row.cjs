/* The first and last differing rows of two PNGs, aligned at the top and at the bottom. */
const fs = require('node:fs');
const { PNG } = require('playwright-core/lib/utilsBundle');
const [a, b] = process.argv
  .slice(2)
  .map((f) => PNG.sync.read(fs.readFileSync(f)));
const row = (png, y) =>
  png.data.subarray(y * png.width * 4, (y + 1) * png.width * 4);
const h = Math.min(a.height, b.height);
let top = -1;
for (let y = 0; y < h; y += 1) {
  if (!row(a, y).equals(row(b, y))) {
    top = y;
    break;
  }
}
let bottom = -1;
for (let i = 1; i <= h; i += 1) {
  if (!row(a, a.height - i).equals(row(b, b.height - i))) {
    bottom = i;
    break;
  }
}
console.log({
  sizes: [a.height, b.height],
  firstDiffFromTop: top,
  firstDiffFromBottom: bottom,
});
