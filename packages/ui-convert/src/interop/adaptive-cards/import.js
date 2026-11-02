/**
 * Adaptive Cards -> ui-dialect document.
 *
 * A card becomes a `document` whose `(stack (role body))` and
 * `(stack (role actions))` children hold the body elements and the card
 * actions. The card of an Action.ShowCard is a separate `document` after
 * the main one, named by `(on press (show-card <id>))`.
 * Mapped keys become properties (see mapping.lino); every other key is kept in `(extra adaptive-cards '<json>')`. Elements outside the
 * supported subset are kept whole as `opaque` elements, with a warning.
 * Elements without an id are anonymous LiNo elements, so no id is invented.
 */

import { Diagnostics } from '../../diagnostics.js';
import { encodeAny, extraProperty } from '../extra.js';
import { IdAllocator, element, prop, writeLino } from '../lino.js';
import { isObject, isUnsafeUrl } from '../safety.js';
import { FORMAT, mapping } from './shared.js';

const ROLES = {
  Container: 'container',
  ColumnSet: 'column-set',
  Column: 'column',
  ActionSet: 'action-set',
};

class CardImporter {
  constructor() {
    this.diagnostics = new Diagnostics(FORMAT);
    this.ids = new IdAllocator(['card']);
    /** Cards of Action.ShowCard, written after the main card. */
    this.shownCards = [];
    /** Ids of the cards being imported, innermost last. */
    this.cards = [];
  }

  /**
   * Build a node from a JSON object: mapped properties, the given extra
   * properties and children, and the rest of the keys in `extra`.
   * @param {string|null} id
   * @param {string} kind
   * @param {string} type
   * @param {Record<string, unknown>} json
   * @param {{ positional?: string[], properties?: object[],
   *   children?: object[], handled?: string[] }} parts
   */
  node(id, kind, type, json, parts) {
    const { properties, handled } = mapping.importProperties(type, json);
    const done = new Set([...handled, ...(parts.handled ?? [])]);
    const rest = Object.fromEntries(
      Object.entries(json).filter(([key]) => !done.has(key))
    );
    return element(id, kind, {
      positional: parts.positional,
      properties: [
        ...(parts.properties ?? []),
        ...properties,
        extraProperty(FORMAT, rest),
      ],
      children: parts.children,
    });
  }

  /**
   * Claim a JSON id as the element id; `handled` lists `id` when claimed.
   * @param {Record<string, unknown>} json
   */
  claim(json) {
    const id = this.ids.claim(json.id);
    return { id, handled: id === null ? [] : ['id'] };
  }

  card(json, id, path) {
    this.cards.push(id);
    const children = [];
    if ('body' in json) {
      children.push(
        this.slot('body', this.list(json.body, `${path}/body`, this.item))
      );
    }
    if ('actions' in json) {
      children.push(
        this.slot(
          'actions',
          this.list(json.actions, `${path}/actions`, this.action)
        )
      );
    }
    const handled = ['type', 'version', 'body', 'actions'].filter((key) =>
      key === 'version'
        ? typeof json.version === 'string'
        : key === 'type' || Array.isArray(json[key])
    );
    this.cards.pop();
    return this.node(id, 'document', 'AdaptiveCard', json, {
      properties: [
        typeof json.version === 'string'
          ? prop('source', FORMAT, json.version)
          : null,
      ],
      children,
      handled,
    });
  }

  slot(role, children) {
    return element(null, 'stack', {
      properties: [
        role === 'actions' ? prop('direction', 'horizontal') : null,
        prop('role', role),
      ],
      children,
    });
  }

  list(items, path, read) {
    if (!Array.isArray(items)) {
      return [];
    }
    return items
      .map((item, index) => read.call(this, item, `${path}/${index}`))
      .filter(Boolean);
  }

  invalid(path) {
    this.diagnostics.error(
      'invalid-element',
      'An element is not an object with a string "type"; it is dropped.',
      { path }
    );
    return null;
  }

  opaque(json, path) {
    this.diagnostics.warning(
      'unsupported-element',
      `"${json.type}" is outside the supported subset; it is kept as an opaque element.`,
      { path }
    );
    const { id, handled } = this.claim(json);
    return this.node(id, 'opaque', json.type, json, {
      properties: [prop('source', FORMAT, json.type)],
      handled: ['type', ...handled],
    });
  }

  item(json, path) {
    if (!isObject(json) || typeof json.type !== 'string') {
      return this.invalid(path);
    }
    const entry = mapping.elements.get(json.type);
    if (!entry || mapping.inGroup('action', json.type)) {
      return this.opaque(json, path);
    }
    if (mapping.inGroup('input', json.type)) {
      return this.input(json, entry.kind, path);
    }
    const { id, handled } = this.claim(json);
    const parts = this.itemParts(json, path);
    const role = ROLES[json.type];
    return this.node(id, entry.kind, json.type, json, {
      ...parts,
      properties: [
        ...(parts.properties ?? []),
        json.type === 'ColumnSet' || json.type === 'ActionSet'
          ? prop('direction', 'horizontal')
          : null,
        role ? prop('role', role) : null,
      ],
      handled: ['type', ...handled, ...(parts.handled ?? [])],
    });
  }

  /** The type-specific parts of a body element. */
  itemParts(json, path) {
    const many = (key, read) =>
      Array.isArray(json[key])
        ? {
            children: this.list(json[key], `${path}/${key}`, read),
            handled: [key],
          }
        : {};
    const text = (key) =>
      typeof json[key] === 'string'
        ? { positional: [json[key]], handled: [key] }
        : {};
    switch (json.type) {
      case 'TextBlock':
        return text('text');
      case 'Image':
        return text('url');
      case 'Container':
      case 'Column':
        return many('items', this.item);
      case 'ColumnSet':
        return many('columns', this.column);
      case 'ActionSet':
        return many('actions', this.action);
      case 'FactSet':
        return this.facts(json);
      default:
        return {};
    }
  }

  column(json, path) {
    if (isObject(json) && json.type === undefined) {
      // `type: "Column"` is optional inside a ColumnSet.
      return this.item({ type: 'Column', ...json }, path);
    }
    return isObject(json) && json.type === 'Column'
      ? this.item(json, path)
      : this.invalid(path);
  }

  facts(json) {
    const plain = (fact) =>
      isObject(fact) &&
      Object.keys(fact).length === 2 &&
      typeof fact.title === 'string' &&
      typeof fact.value === 'string';
    if (!Array.isArray(json.facts) || !json.facts.every(plain)) {
      return {};
    }
    return {
      properties: json.facts.map((f) => prop('fact', f.title, f.value)),
      handled: ['facts'],
    };
  }

  input(json, kind, path) {
    const { id, handled } = this.claim(json);
    const parts = json.type === 'Input.ChoiceSet' ? this.choices(json) : {};
    if (typeof json.id !== 'string') {
      this.diagnostics.warning(
        'input-without-id',
        'An input has no string "id", so it has no binding.',
        { path }
      );
    }
    return this.node(id, kind, json.type, json, {
      properties: [
        typeof json.id === 'string' ? prop('bind', json.id) : null,
        ...(parts.properties ?? []),
      ],
      handled: [
        'type',
        ...handled,
        ...(typeof json.id === 'string' ? ['id'] : []),
        ...(parts.handled ?? []),
      ],
    });
  }

  choices(json) {
    const plain = (choice) =>
      isObject(choice) &&
      Object.keys(choice).length === 2 &&
      typeof choice.title === 'string' &&
      typeof choice.value === 'string';
    if (!Array.isArray(json.choices) || !json.choices.every(plain)) {
      return {};
    }
    return {
      properties: json.choices.map((c) => prop('option', c.value, c.title)),
      handled: ['choices'],
    };
  }

  action(json, path) {
    if (!isObject(json) || typeof json.type !== 'string') {
      return this.invalid(path);
    }
    if (!mapping.inGroup('action', json.type)) {
      return this.opaque(json, path);
    }
    const { id, handled } = this.claim(json);
    const { handler, used = [] } = this.handler(json, id, path);
    return this.node(id, 'button', json.type, json, {
      properties: [handler ? prop('on', 'press', handler) : null],
      handled: ['type', ...handled, ...used],
    });
  }

  /** The `(on press ...)` action of an Adaptive Cards action. */
  handler(json, id, path) {
    switch (json.type) {
      case 'Action.Submit':
        return { handler: ['submit', this.cards.at(-1)] };
      case 'Action.Execute':
        return { handler: ['execute', this.cards.at(-1)] };
      case 'Action.OpenUrl':
        return this.openUrl(json, path);
      case 'Action.ShowCard':
        return this.showCard(json, id, path);
      default:
        return this.toggle(json);
    }
  }

  openUrl(json, path) {
    if (typeof json.url !== 'string') {
      return { handler: ['open-url'] };
    }
    if (isUnsafeUrl(json.url)) {
      this.diagnostics.error(
        'unsafe-url',
        'An Action.OpenUrl URL would run code; it is dropped.',
        { path: `${path}/url` }
      );
      return { handler: ['open-url'], used: ['url'] };
    }
    return { handler: ['open-url', json.url], used: ['url'] };
  }

  showCard(json, id, path) {
    if (!isObject(json.card) || json.card.type !== 'AdaptiveCard') {
      return { handler: ['show-card'] };
    }
    const cardId = this.ids.fresh(`${id ?? 'show'}-card`);
    const index = this.shownCards.length;
    this.shownCards.push(null);
    this.shownCards[index] = this.card(json.card, cardId, `${path}/card`);
    return { handler: ['show-card', cardId], used: ['card'] };
  }

  toggle(json) {
    const targets = json.targetElements;
    const plain = (t) =>
      typeof t === 'string' ||
      (isObject(t) &&
        Object.keys(t).length === 2 &&
        typeof t.elementId === 'string' &&
        typeof t.isVisible === 'boolean');
    if (!Array.isArray(targets) || !targets.every(plain)) {
      return { handler: ['toggle-visibility'] };
    }
    return {
      handler: [
        'toggle-visibility',
        ...targets.map((t) =>
          typeof t === 'string' ? t : [t.elementId, encodeAny(t.isVisible)]
        ),
      ],
      used: ['targetElements'],
    };
  }
}

/**
 * Import an Adaptive Card.
 * @param {unknown} json The card (an object with `type: "AdaptiveCard"`).
 * @param {{ style?: 'inline'|'multiline'|'indented' }} [options]
 * @returns {{ lino: string, roots: object[],
 *   diagnostics: import('../../diagnostics.js').Diagnostic[] }}
 */
export function importAdaptiveCard(json, options = {}) {
  const importer = new CardImporter();
  if (!isObject(json) || json.type !== 'AdaptiveCard') {
    importer.diagnostics.error(
      'not-adaptive-card',
      'The input is not an object with type "AdaptiveCard".',
      { path: '' }
    );
    return { lino: '', roots: [], diagnostics: importer.diagnostics.list };
  }
  const roots = [importer.card(json, 'card', ''), ...importer.shownCards];
  return {
    lino: writeLino(roots, options),
    roots,
    diagnostics: importer.diagnostics.list,
  };
}
