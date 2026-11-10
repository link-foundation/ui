/** Quick controls over a ui-settings bindConfig target; no separate storage. */
import { defineKind } from '@link-foundation/ui-dom';
import {
  controllerOf,
  dropController,
  isLive,
  make,
  setAttr,
  setText,
} from './dom.js';

export const PREF_SWITCHES_SCHEMA = `quick-preferences: schema
  version 1
locale:
  type text
  default en
  (comfort)
sound.enabled:
  type toggle
  default false
  (comfort)
motion.mode:
  type choice
  options auto on off
  default auto
  (comfort)
theme.mode:
  type choice
  options system light dark
  default system
  (comfort)
`;

const THEMES = ['system', 'light', 'dark'];
const MOTION = ['auto', 'on', 'off'];
const nextIn = (list, value) => list[(list.indexOf(value) + 1) % list.length];

function initialPreferences(options) {
  return {
    locale: options.localizer?.locale() ?? 'en',
    'sound.enabled': false,
    'motion.mode': 'auto',
    'theme.mode': 'system',
    ...options.target?.values(),
  };
}

function environment(options) {
  const doc = options.document ?? globalThis.document;
  return {
    doc,
    win: doc.defaultView,
    scope: options.scope ?? doc.documentElement,
    languages: options.languages ?? [{ locale: 'en', label: 'English' }],
  };
}

/** Create preference switches. Labels can be localized with `message(key, params)`.
 * The host persists its config layer and supplies a localizer and bindConfig
 * target shared with its sound/settings adapters.
 */
export function createPrefSwitches(options = {}) {
  const { doc, win, scope: rootScope, languages } = environment(options);
  const element = make(doc, 'ui-pref-switches', {
    role: 'group',
    'aria-label': options.label ?? 'Preferences',
  });
  const scope = rootScope ?? element;
  const languageGroup = make(doc, 'div', {
    role: 'group',
    'aria-label': options.languageLabel ?? 'Language',
  });
  element.appendChild(languageGroup);
  const target = options.target;
  let values = initialPreferences(options);
  const media = win?.matchMedia?.('(prefers-reduced-motion: reduce)');
  const scheme = win?.matchMedia?.('(prefers-color-scheme: dark)');
  const message = (key, params, fallback) =>
    options.message?.(key, params) ?? fallback;
  function commit(key, value) {
    if (target) {
      target.update({ [key]: value });
      values = { ...values, ...target.values() };
    } else {
      values[key] = value;
    }
    refresh();
  }
  const languageButtons = languages.map(({ locale, label }) => {
    const button = make(doc, 'button', { type: 'button' });
    button.appendChild(make(doc, 'span', { lang: locale }, label));
    button.addEventListener('click', () => commit('locale', locale));
    languageGroup.appendChild(button);
    return button;
  });
  const sound = make(doc, 'button', { type: 'button' });
  for (const [state, glyph] of [
    ['on', '♪'],
    ['off', '♩'],
  ]) {
    sound.appendChild(
      make(doc, 'span', { 'data-icon': state, 'aria-hidden': 'true' }, glyph)
    );
  }
  const motion = make(doc, 'button', { type: 'button' });
  const theme = make(doc, 'button', { type: 'button' });
  sound.addEventListener('click', () =>
    commit('sound.enabled', !values['sound.enabled'])
  );
  motion.addEventListener('click', () =>
    commit('motion.mode', nextIn(MOTION, values['motion.mode']))
  );
  theme.addEventListener('click', () =>
    commit('theme.mode', nextIn(THEMES, values['theme.mode']))
  );
  for (const button of [sound, motion, theme]) {
    element.appendChild(button);
  }
  function refresh() {
    const locale = values.locale;
    if (options.localizer?.locale() !== locale) {
      options.localizer?.setLocale(locale);
    }
    languageButtons.forEach((button, i) =>
      button.setAttribute(
        'aria-pressed',
        String(languages[i].locale === locale)
      )
    );
    const enabled = values['sound.enabled'];
    sound.setAttribute('aria-pressed', String(enabled));
    sound.setAttribute(
      'aria-label',
      message('sound', { enabled }, `Sound: ${enabled ? 'on' : 'off'}`)
    );
    for (const icon of sound.children) {
      setAttr(
        icon,
        'hidden',
        (icon.getAttribute('data-icon') === 'on') !== enabled
      );
    }
    const mode = values['motion.mode'];
    const nextMotion = nextIn(MOTION, mode);
    setText(
      motion,
      message(
        'motion',
        { current: mode, next: nextMotion },
        `Motion: ${mode}, next ${nextMotion}`
      )
    );
    const themeMode = values['theme.mode'];
    const nextTheme = nextIn(THEMES, themeMode);
    const themeLabel = message(
      'theme',
      { current: themeMode, next: nextTheme },
      `Theme: ${themeMode}, next ${nextTheme}`
    );
    setText(theme, themeLabel);
    theme.setAttribute('aria-label', themeLabel);
    scope.setAttribute(
      'data-motion',
      mode === 'auto' ? (media?.matches ? 'off' : 'on') : mode
    );
    scope.setAttribute(
      'data-scheme',
      themeMode === 'system' ? (scheme?.matches ? 'dark' : 'light') : themeMode
    );
    scope.style.setProperty(
      'color-scheme',
      themeMode === 'system' ? 'light dark' : themeMode
    );
    options.onChange?.({ ...values });
  }
  const unsubscribe = target?.subscribe?.((next) => {
    values = { ...values, ...next };
    refresh();
  });
  media?.addEventListener('change', refresh);
  scheme?.addEventListener('change', refresh);
  refresh();
  return {
    element,
    refresh,
    destroy() {
      unsubscribe?.();
      media?.removeEventListener('change', refresh);
      scheme?.removeEventListener('change', refresh);
      element.remove();
    },
  };
}

defineKind('pref-switches', {
  tag: 'ui-pref-switches',
  childrenSlot: null,
  create(el, ctx) {
    const control = createPrefSwitches({
      ...ctx.options.layout?.preferences,
      document: ctx.document,
    });
    if (isLive(ctx)) {
      controllerOf(control.element, () => ({ disconnect: control.destroy }));
    }
    return control.element;
  },
  destroy: dropController,
});
