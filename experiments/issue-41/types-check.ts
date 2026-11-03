// Type-checks the public declarations of the package root and ./links-view:
// npx -p typescript@5 tsc --noEmit --strict --module nodenext \
//   --moduleResolution nodenext --lib es2022,dom experiments/issue-41/types-check.ts
import {
  defineLinkView,
  linkGeometry,
  renderLinkSvg,
} from '@link-foundation/ui-components';
import * as lv from '@link-foundation/ui-components/links-view';

export const used = [
  defineLinkView,
  linkGeometry,
  renderLinkSvg,
  lv.createZoomPan,
];
