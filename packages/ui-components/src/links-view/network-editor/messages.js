import { configurationMessages } from '../configuration-notations.js';
import { networkOptionSchema } from './schema.js';
import { networkLooks } from './presets.js';
import { networkShareDestinations } from './share-targets.js';

export const networkEditorMessages = Object.freeze(
  Object.assign(
    {
      notations: 'Notations',
      'notation.theory': 'theory',
      'notation.pairs': 'pairs',
      'notation.number': 'number',
      'notation.decimal': 'decimal',
      'notation.links': 'links',
      notationSummary:
        'n = {count} · base {base} · {digits} digits · one of {networks} networks',
      links: 'Links',
      link: 'Link {index}',
      'reference.source': 'source {index}',
      'reference.target': 'target {index}',
      nothing: '0 — nothing',
      self: '{index} — self',
      linkColor: 'colour {index}',
      'turn.start': 'start turn {index}',
      'turn.end': 'end turn {index}',
      'resetTurn.start': 'Reset start turn {index}',
      'resetTurn.end': 'Reset end turn {index}',
      startGap: 'start gap {index}',
      endGap: 'end gap {index}',
      middleBefore: 'cut before middle {index}',
      middleAfter: 'cut after middle {index}',
      inherit: 'inherit',
      addLink: 'Add link',
      removeLink: 'Remove link {index}',
      previous: 'Previous',
      next: 'Next',
      random: 'Random',
      randomReal: 'Random real links',
      canonicalize: 'Canonical renaming',
      styles: 'Style',
      look: 'Look',
      chooseLook: 'Choose a look',
      size: 'Size',
      chooseSize: 'Choose a size',
      sizePreset: '{width}×{height}',
      reset: 'Reset {section}',
      styleName: 'Style name',
      savedStyles: 'Saved styles',
      saveStyle: 'Save style',
      loadStyle: 'Load style',
      enterStyleName: 'Enter a style name',
      styleSaved: 'Style saved',
      solver: 'Solver',
      apply: 'Apply',
      solving: 'Solving…',
      solverUnavailable: 'Solver unavailable.',
      collisions: 'Collisions {before} → {after}',
      share: 'Share',
      shareTitle: 'Links network',
      networkUrl: 'Network URL',
      shareTargets: 'Share targets',
      'download.svg': 'Download SVG',
      'download.png': 'Download PNG',
      'download.jpg': 'Download JPEG',
      'download.webp': 'Download WEBP',
      'download.lino': 'Download LINO',
      copyLink: 'Copy link',
      copySvg: 'Copy SVG',
      copyImage: 'Copy image',
      done: 'Done',
      sharingUnavailable: 'Sharing unavailable',
      invalidMastodonInstance: 'Enter a valid HTTPS Mastodon instance.',
      error: '{detail}',
    },
    Object.fromEntries(
      Object.entries(configurationMessages.en).map(([key, value]) => [
        `notationError.${key}`,
        value,
      ])
    ),
    Object.fromEntries(
      Object.keys(networkLooks).map((key) => [
        `look.${key}`,
        key === 'social' ? 'social 1200×630' : key,
      ])
    ),
    Object.fromEntries(
      networkOptionSchema.flatMap(({ key, section, choices }) => [
        [`section.${section}`, section],
        [`option.${key}`, key],
        ...(choices ?? []).map((value) => [`choice.${key}.${value}`, value]),
      ])
    ),
    Object.fromEntries(
      Object.entries(networkShareDestinations).map(([id, { label }]) => [
        `target.${id}`,
        label,
      ])
    )
  )
);

export function editorMessage(overrides) {
  return (key, values = {}, fallback) =>
    (overrides?.[key] ?? fallback ?? networkEditorMessages[key] ?? key).replace(
      /\{([\w]+)\}/gu,
      (token, name) =>
        Object.hasOwn(values, name) ? String(values[name]) : token
    );
}
