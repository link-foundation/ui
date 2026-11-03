/**
 * The link-view gallery: defines the element, shows the Links Notation of
 * each view under it, and wires the renderer and colour scheme switches
 * (preset from `?renderer=` and `?theme=`).
 */

import { defineLinkView } from '@link-foundation/ui-components';

defineLinkView(window);

const views = [...document.querySelectorAll('link-view')];
for (const view of views) {
  const source = document.createElement('pre');
  source.textContent = view.getAttribute('lino');
  view.after(source);
}

const params = new URL(window.location.href).searchParams;
const renderer = document.getElementById('renderer');
const theme = document.getElementById('theme');

const apply = () => {
  for (const view of views) {
    view.setAttribute('renderer', renderer.value);
    if (theme.value === '') {
      view.removeAttribute('theme');
    } else {
      view.setAttribute('theme', theme.value);
    }
  }
  if (theme.value === '') {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme.value;
  }
};

renderer.value = params.get('renderer') === 'canvas' ? 'canvas' : 'svg';
theme.value = ['light', 'dark'].includes(params.get('theme'))
  ? params.get('theme')
  : '';
renderer.addEventListener('change', apply);
theme.addEventListener('change', apply);
apply();
