import { defineLinoNetwork } from '../src/links-view/lino-network.js';

defineLinoNetwork();
const network = document.getElementById('network');
const samples = new Map(
  [
    'document',
    'tokens',
    'animation',
    'assets',
    'indented',
    'overrides',
    'styles',
  ].map((name) => [
    `${name}.lino`,
    `../../../docs/case-studies/issue-1/samples/${name}.lino`,
  ])
);
document.getElementById('sample').addEventListener('change', (event) => {
  document.getElementById('selection').textContent =
    'Select a point to locate its source.';
  if (event.target.value === 'syntax-error') {
    network.removeAttribute('src');
    network.lino = 'valid: hello world\nstage: rust: nextest';
  } else {
    const src = samples.get(event.target.value);
    if (!src) {
      return;
    }
    network.removeAttribute('lino');
    network.setAttribute('src', src);
  }
});
for (const name of ['layout', 'theme']) {
  document.getElementById(name).addEventListener('change', (event) => {
    network.setAttribute(name, event.target.value);
    if (name === 'theme') {
      document.documentElement.style.colorScheme = event.target.value;
    }
  });
}
network.addEventListener('select', (event) => {
  const { id, line, column } = event.detail;
  document.getElementById('selection').textContent =
    `${id} · line ${line}, column ${column}`;
});
document.getElementById('svg').addEventListener('click', () => {
  const url = URL.createObjectURL(
    new globalThis.Blob([network.toSvg()], { type: 'image/svg+xml' })
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'lino-network.svg';
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});
