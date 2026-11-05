/* global document, window */
import { format, parse } from '@link-foundation/ui-core';
import { loadTheme } from '@link-foundation/ui-themes';
import { mountControls } from '../../src/controls/index.js';
import '../../src/layout/index.js';

/** One panel of the gallery; `@` keeps the ids of the panels apart. */
const CONTENT = `(page@: container (size medium) (gutters false)
  (bar@: app-bar Inbox (tone primary)
    (bar-action@: button Compose))
  (flat-bar@: app-bar Archive)
  (sheet@: paper (elevation 0)
    (sheet-text@: text 'Paper at elevation 0'))
  (raised@: paper (elevation 3)
    (raised-text@: text 'Paper at elevation 3'))
  (outlined@: paper (variant outlined) (square true)
    (outlined-text@: text 'Outlined square paper'))
  (plan@: card Starter (subtitle 'For one person')
    (plan-text@: text 'One seat and one project.'))
  (team@: card Team (variant outlined)
    (team-text@: text 'Ten seats.'))
  (people@: stack (direction horizontal) (gap 8px) (wrap true)
    (ada@: chip Ada (value ada) (removable true))
    (alan@: chip Alan (value alan) (removable true) (variant outlined) (tone primary))
    (grace@: chip Grace (value grace) (removable true) (tone error))
    (plain@: chip Plain)
    (off@: chip Archived (removable true) (disabled true)))
  (ship@: accordion Shipping
    (ship-text@: text 'Two to five days.')
    (ship-link@: link Tracking (href '#tracking')))
  (back@: accordion Returns (open true)
    (back-text@: text 'Free within thirty days.'))
  (warranty@: accordion Warranty (disabled true)
    (warranty-text@: text 'Two years.'))
  (ring@: progress Uploading (shape circular) (value 40) (max 100))
  (spinner@: progress Loading (shape circular)))`;

const theme = await loadTheme('material3');
const diagnostics = [];
const changes = [];
const panels = new Map();
for (const [id, scheme, contrast] of [
  ['light', 'light', 'normal'],
  ['dark', 'dark', 'normal'],
  ['contrast', 'light', 'more'],
]) {
  const content = parse(CONTENT.replaceAll('@', `-${id}`)).roots[0];
  const text = format({
    roots: [
      {
        id: `app-${id}`,
        kind: 'document',
        positional: [],
        unknown: [],
        properties: [
          { name: 'theme', values: ['material3'] },
          { name: 'scheme', values: [scheme] },
          { name: 'contrast', values: [contrast] },
          { name: 'motion', values: ['system'] },
        ],
        children: [content],
      },
    ],
    unknown: [],
  });
  const container = document.getElementById(id);
  container.addEventListener('ui-change', (event) => {
    changes.push(event.detail);
  });
  panels.set(
    id,
    mountControls(container, text, {
      themes: [theme],
      onDiagnostic: (d) => diagnostics.push(d),
    })
  );
}
window.surfacesGallery = { panels, diagnostics, changes };
document.body.dataset.ready = 'true';
