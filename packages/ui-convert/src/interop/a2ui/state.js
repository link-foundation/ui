/**
 * The client state an A2UI message stream builds: the surfaces, their flat
 * component lists and their data models. Messages are folded into it one at
 * a time, exactly as a client renderer would apply them.
 */

import { isObject, isUnsafeKey } from '../safety.js';
import { MESSAGE_TYPES, SUPPORTED_VERSIONS } from './shared.js';

/**
 * @typedef {{ id: string, version: string|undefined,
 *   create: Record<string, unknown>,
 *   components: Map<string, Record<string, unknown>>,
 *   model: unknown }} Surface
 * @typedef {{ surfaces: Map<string, Surface> }} State
 */

/** @returns {State} */
export const emptyState = () => ({ surfaces: new Map() });

const clone = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

/**
 * The steps of an absolute JSON Pointer (`/a/b~1c` -> `['a', 'b/c']`), or
 * `null` when the path is not absolute.
 * @param {unknown} path
 */
export function pointerSteps(path) {
  if (typeof path !== 'string' || (path !== '' && !path.startsWith('/'))) {
    return null;
  }
  return path
    .split('/')
    .slice(1)
    .filter((step, i, all) => !(step === '' && i === all.length - 1))
    .map((step) => step.split('~1').join('/').split('~0').join('~'));
}

/** The array index of a pointer step, or -1. */
function arrayIndex(list, step) {
  if (step === '-') {
    return list.length;
  }
  const n = Number(step);
  return step !== '' && Number.isInteger(n) && n >= 0 && String(n) === step
    ? n
    : -1;
}

/**
 * Set (or with `value === undefined` remove) the value at `steps` in a
 * data model. Missing objects on the way are created; removing an array
 * item leaves `null` so that the array keeps its length.
 * @returns {unknown} The new model.
 */
function writeModel(model, steps, value) {
  if (steps.length === 0) {
    return clone(value);
  }
  const root = isObject(model) || Array.isArray(model) ? model : {};
  let at = root;
  for (const [i, step] of steps.entries()) {
    const last = i === steps.length - 1;
    const key = Array.isArray(at) ? arrayIndex(at, step) : step;
    if (key === -1 || isUnsafeKey(key)) {
      return root;
    }
    if (last) {
      if (value !== undefined) {
        at[key] = clone(value);
      } else if (Array.isArray(at)) {
        at[key] = null;
      } else {
        delete at[key];
      }
    } else {
      if (!isObject(at[key]) && !Array.isArray(at[key])) {
        at[key] = {};
      }
      at = at[key];
    }
  }
  if (Array.isArray(root) || isObject(root)) {
    fillHoles(root);
  }
  return root;
}

/** Replace array holes (left by writing past the end) with `null`. */
function fillHoles(value) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      if (!(i in value)) {
        value[i] = null;
      }
      fillHoles(value[i]);
    }
  } else if (isObject(value)) {
    Object.values(value).forEach(fillHoles);
  }
}

/**
 * Folds messages into a {@link State}.
 */
export class StateFolder {
  /** @param {import('../../diagnostics.js').Diagnostics} diagnostics */
  constructor(diagnostics) {
    this.diagnostics = diagnostics;
    this.state = emptyState();
  }

  /**
   * Apply one message.
   * @param {unknown} message
   * @param {string} path The JSON path of the message, for diagnostics.
   */
  fold(message, path) {
    const type = this.typeOf(message, path);
    if (type === null) {
      return;
    }
    const payload = message[type];
    if (!isObject(payload) || typeof payload.surfaceId !== 'string') {
      this.diagnostics.error(
        'invalid-message',
        `A ${type} message needs an object with a string "surfaceId"; it is skipped.`,
        { path: `${path}/${type}` }
      );
      return;
    }
    if (type === 'createSurface') {
      this.create(message, payload, path);
      return;
    }
    const surface = this.state.surfaces.get(payload.surfaceId);
    if (!surface) {
      this.diagnostics.warning(
        'unknown-surface',
        `The surface "${payload.surfaceId}" was not created; the ${type} message is skipped.`,
        { path: `${path}/${type}/surfaceId` }
      );
      return;
    }
    if (type === 'deleteSurface') {
      this.state.surfaces.delete(payload.surfaceId);
    } else if (type === 'updateComponents') {
      this.components(surface, payload, `${path}/${type}`);
    } else {
      this.dataModel(surface, payload, `${path}/${type}`);
    }
  }

  /** The message type, or `null` (with a diagnostic) for a bad message. */
  typeOf(message, path) {
    const types = isObject(message)
      ? MESSAGE_TYPES.filter((type) => type in message)
      : [];
    if (types.length !== 1) {
      this.diagnostics.error(
        'invalid-message',
        'A message must be an object with exactly one of createSurface, updateComponents, updateDataModel or deleteSurface; it is skipped.',
        { path }
      );
      return null;
    }
    const extra = Object.keys(message).filter(
      (key) => key !== 'version' && key !== types[0]
    );
    if (extra.length > 0) {
      this.diagnostics.warning(
        'unknown-key',
        `Unknown message keys are dropped: ${extra.join(', ')}.`,
        { path }
      );
    }
    if ('version' in message && !SUPPORTED_VERSIONS.includes(message.version)) {
      this.diagnostics.warning(
        'unsupported-version',
        `The message version ${JSON.stringify(message.version)} is not one of ${SUPPORTED_VERSIONS.join(', ')}; it is read as ${SUPPORTED_VERSIONS.at(-1)}.`,
        { path: `${path}/version` }
      );
    }
    return types[0];
  }

  create(message, payload, path) {
    if (this.state.surfaces.has(payload.surfaceId)) {
      this.diagnostics.warning(
        'duplicate-surface',
        `The surface "${payload.surfaceId}" is created again; it starts over.`,
        { path: `${path}/createSurface/surfaceId` }
      );
      this.state.surfaces.delete(payload.surfaceId);
    }
    this.state.surfaces.set(payload.surfaceId, {
      id: payload.surfaceId,
      version: SUPPORTED_VERSIONS.includes(message.version)
        ? message.version
        : undefined,
      create: clone(payload),
      components: new Map(),
      model: undefined,
    });
  }

  components(surface, payload, path) {
    if (!Array.isArray(payload.components)) {
      this.diagnostics.error(
        'invalid-message',
        'updateComponents needs a "components" array; the message is skipped.',
        { path }
      );
      return;
    }
    payload.components.forEach((component, i) => {
      if (
        !isObject(component) ||
        typeof component.id !== 'string' ||
        component.id === '' ||
        typeof component.component !== 'string'
      ) {
        this.diagnostics.error(
          'invalid-component',
          'A component needs a non-empty string "id" and a string "component"; it is skipped.',
          { path: `${path}/components/${i}` }
        );
        return;
      }
      surface.components.set(component.id, clone(component));
    });
  }

  dataModel(surface, payload, path) {
    const steps = pointerSteps(payload.path ?? '/');
    if (steps === null) {
      this.diagnostics.error(
        'invalid-path',
        'A data model path must be an absolute JSON Pointer; the update is skipped.',
        { path: `${path}/path` }
      );
      return;
    }
    if (steps.some(isUnsafeKey)) {
      this.diagnostics.error(
        'unsafe-path',
        'A data model path may not name __proto__, constructor or prototype; the update is skipped.',
        { path: `${path}/path` }
      );
      return;
    }
    surface.model = writeModel(surface.model, steps, payload.value);
  }
}
