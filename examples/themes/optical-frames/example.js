/* global document */
import {
  readFrames,
  resolveFrame,
  frameGeometry,
  frameStyle,
} from '@link-foundation/ui-themes/classic/frames';
import {
  readMaterial,
  materialStyle,
} from '@link-foundation/ui-themes/classic/materials';
import { readStyles, compileCss } from '@link-foundation/ui-style';

const schema = readFrames(`frames
  panel
    corner top-left cut
      size 60
      width 44
      color '#71e3ff'
      stroke 2
    corner top-right round
      size 36
      color '#71e3ff'
      stroke 2
    corner bottom-right scoop
      size 32
      color '#71e3ff'
      stroke 2
    corner bottom-left notch
      size 28
      color '#71e3ff'
      stroke 2
    edge top bracket
      stroke 3
      gap 30
      color '#71e3ff'
    edge right gap
      stroke 2
      gap 8
      color '#71e3ff'
    edge bottom accent
      stroke 4
      color '#71e3ff'
    state selected
      edge left accent
        color '#ffd779'
        stroke 5
`);
const legacy = new globalThis.URLSearchParams(globalThis.location.search).has(
  'before'
);
const legacyCss = compileCss(
  readStyles(frameStyle({ corner: 'cut', size: 12 })).rules
).replaceAll('ui-panel', 'article');
const style = document.createElement('style');
style.textContent = legacy
  ? `${legacyCss} article { --color-surface: #123b4a; --color-primary: #71e3ff; --surface-opacity: 0.65; }`
  : '';
document.head.append(style);
for (const [name, color, opacity] of [
  ['Glass', '#0b263b', 0.45],
  ['Liquid', '#164a68', 0.65],
  ['Transparent', 'inherit', 1],
]) {
  const article = document.createElement('article');
  article.setAttribute('aria-label', name);
  const geometry = frameGeometry(
    resolveFrame(schema, 'panel', ['selected']),
    320,
    200
  );
  const material = readMaterial(
    `surface: material\n  color '${color}'\n  opacity ${opacity}\n  blur 2\n  noise 0.1\n  refraction 0.2\n`
  );
  const surface = document.createElement('div');
  surface.className = 'material';
  if (!legacy) {
    for (const [key, value] of Object.entries(materialStyle(material))) {
      surface.style.setProperty(key, value);
    }
    surface.style.clipPath = geometry.clipPath;
  }
  const border = document.createElement('div');
  border.className = 'border';
  border.innerHTML = legacy ? '' : geometry.borderSvg;
  const content = document.createElement('div');
  content.className = 'content';
  const title = document.createElement('h2');
  title.textContent = name;
  const text = document.createElement('p');
  text.textContent = 'Four corners. Four independent edges.';
  content.append(title, text);
  article.append(surface, border, content);
  document.getElementById('frames').append(article);
}
globalThis.framesReady = true;
