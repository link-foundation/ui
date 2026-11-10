/**
 * Bounded scan for issue 249: painted report of `22 11` with link 1 turns
 * `-90 90` for a range of fixed baseline end angles (no middle exemption).
 * Usage: node experiments/issue-249/angle-scan.mjs [step]
 */
import { doubletGeometry } from '../../packages/ui-components/src/links-view/doublet.js';
import { paintedReport } from '../../packages/ui-components/tests/links-view/doublet-painted.js';

const step = Number(process.argv[2] ?? 15);
for (let source = 0; source <= 90; source += step) {
  for (let target = 0; target <= 90; target += step) {
    const text = `angles fixed\nsourceAngle ${source}\ntargetAngle ${target}\nlink 1\n  turns -90 90\n`;
    const r = paintedReport(
      doubletGeometry(
        [
          [2, 2],
          [1, 1],
        ],
        text
      ),
      { steps: 64 }
    );
    console.log(
      source,
      target,
      r.crossings.length,
      r.ownCrossings.length,
      r.gap.toFixed(3)
    );
  }
}
