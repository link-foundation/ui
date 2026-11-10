import { defineEmbedElement } from '@link-foundation/ui-components/embed';
import '../src/embed/providers/x.js';

defineEmbedElement();
const parameters = new URLSearchParams(location.search);
const posts = document.getElementById('posts');
if (parameters.has('far')) {
  posts.style.marginTop = '2400px';
}
for (let index = 0; index < Number(parameters.get('count') ?? 1); index++) {
  const embed = document.createElement('ui-embed');
  embed.setAttribute('provider', 'x');
  embed.setAttribute('id', parameters.get('id') ?? '20');
  embed.setAttribute('toggle', 'true');
  embed.setAttribute('timeout', parameters.get('timeout') ?? '12000');
  const archive = document.createElement('article');
  archive.setAttribute('slot', 'fallback');
  const heading = document.createElement('h2');
  heading.textContent = 'Archived post';
  const text = document.createElement('p');
  text.textContent =
    'Example archived content supplied by the host. This remains available when the provider cannot load.';
  archive.append(heading, text);
  embed.append(archive);
  posts.append(embed);
}
document.getElementById('theme').addEventListener('click', () => {
  document.documentElement.dataset.scheme =
    document.documentElement.dataset.scheme === 'dark' ? 'light' : 'dark';
});
