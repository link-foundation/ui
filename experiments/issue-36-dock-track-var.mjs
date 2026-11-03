// Does jsdom (cssstyle) keep a grid track with var() and min()?
import { JSDOM } from 'jsdom';

const { document } = new JSDOM('<div></div>').window;
const div = document.querySelector('div');
for (const value of [
  '16rem minmax(var(--ui-dock-center-min, 12rem), 1fr) 18rem',
  'minmax(0, min(16rem, 30%)) minmax(0, 1fr) 18rem',
]) {
  div.style.setProperty('grid-template-columns', value);
  console.log(
    JSON.stringify(div.style.getPropertyValue('grid-template-columns'))
  );
}
