/* Print the bounding box of the red (changed) pixels of Playwright diff images. */
const fs = require('node:fs');
const { PNG } = require('playwright-core/lib/utilsBundle');
for (const file of process.argv.slice(2)) {
  const png = PNG.sync.read(fs.readFileSync(file));
  const box = [Infinity, Infinity, -1, -1];
  let count = 0;
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      const i = (y * png.width + x) * 4;
      const [r, g, b] = png.data.slice(i, i + 3);
      if (r > 200 && g < 80 && b < 80) {
        count += 1;
        box[0] = Math.min(box[0], x);
        box[1] = Math.min(box[1], y);
        box[2] = Math.max(box[2], x);
        box[3] = Math.max(box[3], y);
      }
    }
  }
  console.log(file.slice(-50), png.width, png.height, count, box.join(','));
}
