import { formatLinks } from '@link-foundation/ui-core';
import { translator } from './messages.js';
import { defaultPolicy } from './policy.js';
import { decodeShareHash, SHARE_PREFIX } from './share.js';
import { validateOverrides } from './validate.js';

export const BACKUP_KEY = 'ui-overrides:before-the-link';

/** Validate external text, back up both writable layers, then preview in session only. */
export function applySharedOverrides({
  config,
  location,
  history,
  storage,
  schema = config.effective(),
  policy = defaultPolicy(),
  text,
  document,
  t = translator(),
}) {
  const fromHash = text === undefined;
  if (fromHash && !location.hash.startsWith(SHARE_PREFIX)) {
    return null;
  }
  const input = fromHash ? decodeShareHash(location.hash) : text;
  const report = validateOverrides(input, { schema, policy });
  report.applied = false;
  if (!policy.enabled || !policy.writeLayers.includes('session')) {
    report.links = [];
    report.rejected.push({
      link: null,
      reason: 'Site policy forbids session previews',
    });
  }
  const before = {
    name: 'Before the link',
    user: config.overrides('user'),
    session: config.overrides('session'),
  };
  preview(config, storage, before, report);
  if (fromHash) {
    history.replaceState(
      history.state,
      '',
      location.pathname + location.search
    );
  }
  let banner;
  const finish = () => banner?.remove();
  report.keep = finish;
  report.discard = () => {
    if (report.applied) {
      config.clear('session');
      for (const o of before.session) {
        config.set('session', o.id, o.name, o.values, o.key ?? undefined);
      }
    }
    finish();
  };
  if (document) {
    banner = showBanner(document, report, t);
  }
  return report;
}

function preview(config, storage, before, report) {
  const sets =
    report.links[0]?.values.filter(
      (link) => Array.isArray(link) && link[0] === 'set'
    ) ?? [];
  if (sets.length) {
    try {
      storage.setItem(
        BACKUP_KEY,
        formatLinks([
          {
            id: 'before-the-link',
            values: [
              'backup',
              ['name', before.name],
              ...['user', 'session'].map((layer) => [
                layer,
                ...before[layer].map((o) => [
                  'set',
                  o.id,
                  o.name,
                  ...(o.key === null || o.key === undefined ? [] : [o.key]),
                  ...o.values,
                ]),
              ]),
            ],
          },
        ])
      );
      const result = config.importPatch(formatLinks(report.links), 'session');
      if (!result.ok) {
        throw new Error(result.diagnostics.map((d) => d.message).join('; '));
      }
      report.applied = true;
    } catch (error) {
      report.rejected.push({ link: null, reason: error.message });
    }
  }
}

function showBanner(document, report, t) {
  const banner = document.createElement('aside');
  banner.dataset.uiDevmode = 'shared';
  banner.setAttribute('aria-label', t('shared.title'));
  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.textContent = t('shared.title');
  banner.append(status);
  for (const { link, reason } of report.rejected) {
    const rejection = document.createElement('p');
    rejection.textContent =
      link === null
        ? reason
        : `${formatLinks([link], { style: 'inline' }).trim()}: ${reason}`;
    banner.append(rejection);
  }
  for (const [key, action] of [
    ['shared.keep', report.keep],
    ['shared.discard', report.discard],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = t(key);
    button.onclick = action;
    banner.append(button);
  }
  document.body.prepend(banner);

  return banner;
}
