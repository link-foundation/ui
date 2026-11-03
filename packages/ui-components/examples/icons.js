/**
 * The icon gallery (icons.html): shows every icon name, switches the icon
 * set, the theme and the direction. Sets other than `own` come from the
 * modules of `node scripts/build-icons.mjs` (dist/icons/<set>.js).
 */

import {
  ICON_NAMES,
  ICON_TAG,
  createStaticSource,
  getIconSet,
  iconRecords,
  registerIconSet,
} from '@link-foundation/ui-components';

const SETS = ['own', 'lucide', 'tabler', 'material-symbols'];
const grid = document.getElementById('grid');
const status = document.getElementById('status');
const credits = document.getElementById('credits');

for (const name of ICON_NAMES) {
  const item = document.createElement('li');
  const icon = document.createElement(ICON_TAG);
  icon.setAttribute('name', name);
  const caption = document.createElement('code');
  caption.textContent = name;
  item.append(icon, caption);
  grid.append(item);
}

const icons = () => [...document.querySelectorAll(ICON_TAG)];

/** Register a built set (once). */
async function loadSet(set) {
  if (getIconSet(set) !== undefined) {
    return;
  }
  const module = await import(`../dist/icons/${set}.js`);
  registerIconSet(set, createStaticSource(module.default));
}

function showCredits(set) {
  const records = iconRecords([set]);
  const unique = (field) => [
    ...new Set(records.flatMap((r) => r[field].split('; ')).sort()),
  ];
  const owners = unique('copyright').filter((c) => c !== 'none');
  credits.textContent = `${set}: ${unique('license').join(', ')}, ${
    owners.length === 0 ? 'public domain (ours)' : `© ${owners.join('; ')}`
  }. Full list: dist/icons/NOTICE.lino`;
}

async function useSet(set) {
  status.removeAttribute('data-error');
  status.textContent = '';
  try {
    await loadSet(set);
  } catch {
    status.setAttribute('data-error', '');
    status.textContent = `The ${set} set is not built: run node scripts/build-icons.mjs`;
    return;
  }
  for (const icon of icons()) {
    icon.setAttribute('set', set);
  }
  await Promise.all(icons().map((icon) => icon.ready));
  showCredits(set);
  document.documentElement.dataset.iconSet = set;
}

const useTheme = (theme) => {
  document.documentElement.dataset.theme = theme;
};
const useDir = (dir) => {
  document.documentElement.dir = dir;
};

const ACTIONS = { set: useSet, theme: useTheme, dir: useDir };

document.addEventListener('change', (event) => {
  const { name, value } = event.target;
  ACTIONS[name]?.(value);
});

const params = new globalThis.URLSearchParams(location.search);
for (const [name, action] of Object.entries(ACTIONS)) {
  const value = params.get(name);
  const input =
    value &&
    document.querySelector(
      `input[name="${name}"][value="${CSS.escape(value)}"]`
    );
  if (input) {
    input.checked = true;
    await action(value);
  }
}
if (!document.documentElement.dataset.iconSet) {
  await useSet(SETS[0]);
}
document.documentElement.dataset.ready = 'true';
