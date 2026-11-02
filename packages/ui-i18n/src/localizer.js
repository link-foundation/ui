/**
 * `createLocalizer`: the locale of a document (the root prop `locale`,
 * resolved through the ui-config layers), its text direction, and message
 * text from catalogs through lino-i18n.
 */

import {
  createI18n,
  determineLocale,
  getLocaleDirection,
} from 'lino-i18n/browser';
import { isMessage, parseMessage } from './message.js';
import { localizeDocument } from './document.js';

/**
 * @typedef {import('./catalogs.js').Catalogs} Catalogs
 * @typedef {import('./message.js').Message} Message
 * @typedef {(locale: string, previous: string) => void} LocaleListener
 */

/** The prop of the document root that holds the locale. */
export const LOCALE_PROP = 'locale';

/**
 * `ltr` or `rtl` for a BCP 47 tag (wraps lino-i18n `getLocaleDirection`,
 * which reads `Intl.Locale` text info). Invalid tags are `ltr`.
 * @param {string} locale
 * @returns {'ltr'|'rtl'}
 */
export function localeDirection(locale) {
  try {
    return getLocaleDirection(locale) === 'rtl' ? 'rtl' : 'ltr';
  } catch {
    return 'ltr';
  }
}

/** The best approved locale for `requested`, or `requested` itself. */
function matchLocale(requested, approved) {
  try {
    return determineLocale([requested], approved) ?? requested;
  } catch {
    return requested;
  }
}

/** The preferred languages of the platform (`navigator.languages`). */
const platformLanguages = () => {
  const nav = globalThis.navigator;
  if (Array.isArray(nav?.languages) && nav.languages.length > 0) {
    return [...nav.languages];
  }
  return typeof nav?.language === 'string' ? [nav.language] : [];
};

/**
 * Resolve a value to text: a message, a raw `(t ...)` link, or literal text.
 * @param {unknown} value
 * @param {{ text(value: unknown, params?: object): string }} localizer
 * @param {Record<string, unknown>} [params]
 * @returns {string}
 */
export const resolveText = (value, localizer, params) =>
  localizer.text(value, params);

/**
 * @param {{
 *   config?: import('@link-foundation/ui-config').Config,
 *   catalogs: Catalogs,
 *   approved?: string[],
 *   defaultLocale?: string,
 *   root?: string|null,
 *   locale?: string,
 *   languages?: readonly string[],
 *   layer?: 'user'|'session',
 *   onMissing?: (key: string, locale: string) => void,
 *   onListenerError?: (error: unknown) => void,
 * }} options
 */
export function createLocalizer(options) {
  const {
    config,
    catalogs,
    defaultLocale = 'en',
    layer = 'user',
    onMissing,
    onListenerError = (error) => console.error(error),
  } = options ?? {};
  if (catalogs === null || typeof catalogs !== 'object') {
    throw new TypeError('createLocalizer: options.catalogs is required');
  }
  const approved = [...(options.approved ?? Object.keys(catalogs))];
  const root = options.root ?? config?.base ?? null;
  const i18n = createI18n({
    locales: catalogs,
    defaultLocale,
    fallback: [defaultLocale],
    onMissingKey: (info) => {
      onMissing?.(info.key, info.options?.locale ?? locale());
      return undefined;
    },
  });
  /** The locale set with `setLocale` when there is no config. */
  let own = options.locale;
  const listeners = new Set();
  let stopConfig = null;
  let last = null;

  /** The requested locale before matching it with the approved ones. */
  function requested() {
    if (config && root !== null) {
      const [value] = config.resolve(root, LOCALE_PROP)?.value ?? [];
      if (typeof value === 'string' && value !== '') {
        return value;
      }
    }
    if (own) {
      return own;
    }
    const languages = options.languages ?? platformLanguages();
    return determineLocale(languages, approved) ?? defaultLocale;
  }

  function locale() {
    return matchLocale(requested(), approved);
  }

  function notify() {
    const current = locale();
    if (current === last) {
      return;
    }
    const previous = last;
    last = current;
    for (const listener of [...listeners]) {
      try {
        listener(current, previous);
      } catch (error) {
        onListenerError(error);
      }
    }
  }

  /** @param {unknown} value */
  function text(value, params = {}) {
    if (typeof value === 'string') {
      return value;
    }
    const msg = isMessage(value) ? value : parseMessage(value);
    if (!msg) {
      return value === null || value === undefined ? '' : String(value);
    }
    const resolved = {};
    for (const [name, param] of Object.entries(msg.params ?? {})) {
      resolved[name] = isMessage(param) ? text(param) : param;
    }
    return i18n.t(msg.key, { ...resolved, ...params }, { locale: locale() });
  }

  const localizer = {
    locale,
    direction: () => localeDirection(locale()),
    approved: () => [...approved],
    text,
    has: (key, at = locale()) => i18n.has(key, at),
    localizeDocument: (doc) => localizeDocument(doc, localizer, { root }),
    /**
     * Switch the locale: with a config, an override of `layer` (default
     * `user`) on the root; `null` removes it.
     * @param {string|null} next
     */
    setLocale(next) {
      if (config && root !== null) {
        if (next === null) {
          config.unset(layer, root, LOCALE_PROP);
        } else {
          config.set(layer, root, LOCALE_PROP, [next]);
        }
        return;
      }
      own = next ?? undefined;
      notify();
    },
    /**
     * `listener(locale, previous)` after each locale change.
     * @param {LocaleListener} listener
     * @returns {() => boolean} unsubscribe
     */
    subscribe(listener) {
      if (listeners.size === 0) {
        last = locale();
        if (config && root !== null) {
          stopConfig = config.subscribe((events) => {
            if (events.some((e) => e.id === root && e.name === LOCALE_PROP)) {
              notify();
            }
          });
        }
      }
      listeners.add(listener);
      return () => {
        const removed = listeners.delete(listener);
        if (removed && listeners.size === 0 && stopConfig) {
          stopConfig();
          stopConfig = null;
        }
        return removed;
      };
    },
  };
  return localizer;
}
