import { createStaticSource, registerIconSet } from '../src/icons/index.js';
import {
  createLocalizer,
  iconPart,
  message,
  messageParts,
  readCatalogs,
} from '../../ui-i18n/src/browser.js';

// Compile the manifest once; no icon library resolver ships to the browser.
for (const set of ['brand', 'lucide']) {
  const { default: data } = await import(`../dist/icons/inline/${set}.js`);
  registerIconSet(set, createStaticSource(data));
}
const catalogs = readCatalogs(`en
  sentence 'I {love} links. {unknown}'
  love love
ru
  sentence 'Я {love} links. {unknown}'
  love люблю`);
const localizer = createLocalizer({ catalogs, locale: 'en' });
const sentence = document.querySelector('#sentence');
function render() {
  sentence.replaceChildren(
    ...messageParts(message('sentence'), localizer, {
      love: iconPart('lucide:heart', message('love')),
    }).map((part) => {
      if (typeof part === 'string') {
        return document.createTextNode(part);
      }
      const icon = document.createElement('ui-icon');
      for (const name of ['set', 'name', 'label', 'role']) {
        icon.setAttribute(name, part[name]);
      }
      icon.setAttribute('fill', 'current');
      icon.setAttribute('size', '1em');
      return icon;
    })
  );
  sentence.lang = localizer.locale();
}
localizer.subscribe(render);
document
  .querySelector('#locale')
  .addEventListener('change', (event) =>
    localizer.setLocale(event.target.value)
  );
document
  .querySelector('#theme')
  .addEventListener(
    'change',
    (event) => (document.documentElement.dataset.theme = event.target.value)
  );
render();
await Promise.all(
  [...document.querySelectorAll('ui-icon')].map((icon) => icon.ready)
);
document.documentElement.dataset.ready = 'true';
