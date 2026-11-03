// Shape of links-notation Link objects for the dev-mode policy (#54).
import { Parser } from 'links-notation';
const links = new Parser().parse(`(app: document (x 1))
(site-dev-mode: dev-mode
  (enabled true)
  (shortcut 'Alt+Shift+D')
  (write-layers session user))`);
console.log(JSON.stringify(links, null, 1));
