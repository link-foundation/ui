import { parse } from '@link-foundation/ui-core';
import { createConfig } from '@link-foundation/ui-config';
import { createSettingsPanel } from '@link-foundation/ui-components/settings';
import {
  readSoundTheme,
  createSoundSettingsSchema,
  bindSoundConfig,
  createSoundPlayer,
  bindSoundToDocument,
} from '@link-foundation/ui-sound';

const { theme } = readSoundTheme(
  await (await fetch('../themes/immortality.lino')).text()
);
const schema = createSoundSettingsSchema(theme, [
  { name: 'activate', label: 'Activate' },
]);
const config = bindSoundConfig(
  createConfig({ document: parse('settings: box') }),
  { schema }
);
const player = createSoundPlayer({ theme, config });
const binding = bindSoundToDocument(player);
const status = document.querySelector('#status');
const panel = createSettingsPanel(schema, {
  label: 'Sound settings',
  target: config,
  mountPreview({ container, field, values }) {
    let current = values;
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = '▶';
    button.setAttribute('aria-label', `Preview ${field.label}`);
    button.dataset.sound = ''; // The preview handles this click itself.
    button.addEventListener('click', () => player.preview(current[field.key]));
    container.append(button);
    return {
      update(next) {
        current = next;
        button.disabled = current[field.key] === 'none';
      },
    };
  },
});
document.querySelector('#settings').append(panel.element);
player.onCue(({ event }) => {
  status.textContent = `Cue: ${event}`;
});
// Exposed only by this demo for browser verification.
window.soundDemo = { player, panel, config };
window.addEventListener(
  'pagehide',
  () => {
    panel.destroy();
    binding.dispose();
    void player.dispose();
  },
  { once: true }
);
