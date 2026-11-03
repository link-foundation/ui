/* global document, window */
import { loadTheme } from '@link-foundation/ui-themes';
import {
  mountControls,
  controlsVocabulary,
} from '../../packages/ui-components/src/controls/index.js';
import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';

const controls = await (await fetch('./hig-controls.lino')).text();
const mounted = new Map();
const configs = new Map();
const diagnostics = [];
for (const mode of ['light', 'dark', 'high-contrast']) {
  for (const variant of ['ios', 'macos']) {
    const theme = await loadTheme(`hig-${variant}`);
    const id = `${variant}-${mode}`;
    const section = document.createElement('section');
    section.id = id;
    const heading = document.createElement('h2');
    heading.id = `${id}-heading`;
    heading.textContent = `${variant === 'ios' ? 'iOS' : 'macOS'} · ${mode}`;
    section.setAttribute('aria-labelledby', heading.id);
    section.appendChild(heading);
    const container = document.createElement('div');
    section.appendChild(container);
    document.getElementById('gallery').appendChild(section);
    const text = `${id}: document\n  theme hig-${variant}\n  scheme ${mode === 'dark' ? 'dark' : 'light'}\n  contrast ${mode === 'high-contrast' ? 'more' : 'normal'}\n  motion system\n${controls
      .replaceAll('demo-', `${id}-`)
      .trimEnd()
      .split('\n')
      .map((line) => `  ${line}`)
      .join('\n')}`;
    const config = createConfig({
      document: parse(text, { vocabulary: controlsVocabulary() }),
    });
    configs.set(id, config);
    const result = mountControls(container, text, {
      themes: [theme],
      config,
      parseOptions: { vocabulary: controlsVocabulary() },
      onDiagnostic: (diagnostic) => diagnostics.push(diagnostic),
      host: {
        emit(event) {
          if (!['increase', 'decrease'].includes(event)) {
            return;
          }
          const field = `${id}-guests`;
          const value = Number(
            result.store.get(field).properties.find((p) => p.name === 'value')
              ?.values[0] ?? 2
          );
          result.store.setProp(field, 'value', [
            String(
              Math.min(10, Math.max(0, value + (event === 'increase' ? 1 : -1)))
            ),
          ]);
          result.handle.flush();
        },
      },
    });
    mounted.set(id, result);
  }
}
window.higGallery = { mounted, configs, diagnostics };
document.body.dataset.ready = 'true';
