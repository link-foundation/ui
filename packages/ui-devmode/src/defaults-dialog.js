import { exportOverrides } from './export.js';
import { shareUrl, URL_BUDGET } from './share.js';
import { renderAgentInstruction } from './agent-instruction.js';

/** Accessible native modal: browser focus trap/inert background, Escape, focus restoration. */
export function openDefaultsDialog({ window, config, policy, t }) {
  const document = window.document;
  const restoreFocus =
    document.activeElement?.shadowRoot?.activeElement ?? document.activeElement;
  const patch = exportOverrides(config);
  const share = shareUrl(window.location, patch.text);
  const instruction = renderAgentInstruction({
    repository: policy.repository,
    siteConfig: policy.siteConfig,
    overrides: patch.text,
  });
  const host = document.createElement('ui-defaults-dialog');
  host.dataset.uiDevmode = 'dialog';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = `:host { color-scheme: light dark; } dialog { background: Canvas; color: CanvasText; border: 1px solid; border-radius: 8px; width: min(640px, 85vw); max-height: 85vh; overflow: auto; font: 14px system-ui; } dialog::backdrop { background: #0008; } textarea { display: block; box-sizing: border-box; width: 100%; height: 100px; margin: 8px 0; background: Canvas; color: CanvasText; } button { appearance: none; background: Canvas; color: CanvasText; border: 1px solid; border-radius: 4px; padding: 4px 8px; } button:disabled { opacity: .5; } a { color: LinkText; } button, a { margin: 4px 12px 12px 0; } label { display: block; font-weight: bold; }`;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'defaults-title');
  const title = document.createElement('h2');
  title.id = 'defaults-title';
  title.textContent = t('defaults.title');
  const count = document.createElement('p');
  count.setAttribute('aria-live', 'polite');
  count.textContent = t('defaults.count', { count: patch.count });
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  dialog.append(title, count);
  for (const [key, value] of [
    ['defaults.overrides', patch.text],
    ['defaults.share', share.url],
    ['defaults.instruction', instruction],
  ]) {
    const label = document.createElement('label');
    label.textContent = t(key);
    const area = document.createElement('textarea');
    area.readOnly = true;
    area.value = value;
    label.append(area);
    const copy = document.createElement('button');
    copy.type = 'button';
    copy.textContent = t('defaults.copy');
    copy.setAttribute('aria-label', t('defaults.copyLabel', { name: t(key) }));
    copy.disabled = key === 'defaults.share' && share.tooLong;
    copy.onclick = async () => {
      try {
        await window.navigator.clipboard.writeText(value);
        status.textContent = t('defaults.copied');
      } catch {
        area.focus();
        area.select();
        status.textContent = t('defaults.select');
      }
    };
    dialog.append(label, copy);
  }
  if (share.tooLong) {
    const warning = document.createElement('p');
    warning.textContent = t('defaults.tooLong');
    dialog.append(warning);
  }
  appendIssueLink(dialog, { window, policy, instruction, t });
  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = t('defaults.close');
  close.onclick = () => dialog.close();
  dialog.append(status, close);
  shadow.append(style, dialog);
  document.body.append(host);
  dialog.addEventListener('close', () => {
    host.remove();
    restoreFocus?.focus();
  });
  trapFocus(dialog, shadow);
  dialog.showModal();
  return { host, close: () => dialog.close() };
}

function trapFocus(dialog, shadow) {
  dialog.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') {
      return;
    }
    const controls = [
      ...dialog.querySelectorAll('textarea, button:not(:disabled), a[href]'),
    ];
    const at = controls.indexOf(shadow.activeElement);
    event.preventDefault();
    const next =
      (at + (event.shiftKey ? -1 : 1) + controls.length) % controls.length;
    controls[next].focus();
  });
}

function appendIssueLink(dialog, { window, policy, instruction, t }) {
  const document = window.document;
  // Repository is a policy value, but it still must not control the URL scheme/host.
  if (
    typeof policy.repository === 'string' &&
    /^[\w.-]+\/[\w.-]+$/.test(policy.repository)
  ) {
    const url = new window.URL(
      `https://github.com/${policy.repository}/issues/new`
    );
    url.searchParams.set('title', 'Make UI overrides the defaults');
    url.searchParams.set('body', instruction);
    if (url.href.length <= URL_BUDGET) {
      const link = document.createElement('a');
      link.href = url.href;
      link.textContent = t('defaults.issue');
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      dialog.append(link);
    }
  }
}
