/**
 * `readSchema(text)`: read a settings schema written in Links Notation.
 *
 * ```lino
 * (settings-schema: schema (version 2))
 * (appearance: section (label 'Appearance'))
 * (liquid.blur: (type range) (default 18) (min 0) (max 40) (step 1) (unit px)
 *   (section appearance) (label 'Blur') (apply (css-var --liquid-blur)))
 * (preset calm (label 'Calm') (set liquid.blur 24))
 * (migration (from 1) (to 2) (rename blur liquid.blur) (old-default liquid.blur 12))
 * ```
 */

import { coerce } from './coerce.js';
import {
  clausesOf,
  diagnostic,
  rawOf,
  readRecords,
  UNSAFE_KEYS,
} from './read.js';
import { fieldType, toNumber } from './types.js';

/** @typedef {import('./read.js').Diagnostic} Diagnostic */
/** @typedef {import('./read.js').LinkRecord} LinkRecord */

/**
 * @typedef {{ cssVar?: string, dataAttr?: string }} ApplyTarget
 * @typedef {{
 *   key: string, type: string, default: unknown, label?: string,
 *   description?: string, section?: string, min?: number, max?: number,
 *   step?: number, unit?: string, options?: string[], comfort: boolean,
 *   apply: ApplyTarget[], props: Record<string, unknown>,
 * }} SettingField
 * @typedef {{ id: string, label?: string, description?: string }} SettingsSection
 * @typedef {{ id: string, label?: string, description?: string,
 *   values: Record<string, unknown> }} SettingsPreset
 * @typedef {{ from: number, to: number,
 *   renames: Array<{ from: string, to: string }>,
 *   oldDefaults: Array<{ key: string, raw: unknown }> }} SettingsMigration
 * @typedef {{
 *   version: number, fields: Map<string, SettingField>,
 *   sections: SettingsSection[], presets: Map<string, SettingsPreset>,
 *   migrations: SettingsMigration[],
 * }} SettingsSchema
 */

const KINDS = ['schema', 'section', 'preset', 'migration', 'setting'];
const NUMERIC = ['min', 'max', 'step'];
const TEXT = ['label', 'description', 'section', 'unit'];

const isAtom = (value) => typeof value === 'string';

/** The kind and id of a record (`(id: kind …)` or `(kind id …)`). */
function headOf(record) {
  const [first, second] = record.values;
  if (record.id !== null) {
    const kind = isAtom(first) && KINDS.includes(first) ? first : null;
    return { kind: kind ?? 'setting', id: record.id, rest: kind ? 1 : 0 };
  }
  if (isAtom(first) && KINDS.includes(first)) {
    const named = first !== 'schema' && first !== 'migration' && isAtom(second);
    return { kind: first, id: named ? second : null, rest: named ? 2 : 1 };
  }
  return { kind: null, id: null, rest: 0 };
}

const text = (args) => (args.every(isAtom) ? args.join(' ') : undefined);

function readApply(args, at, diagnostics) {
  const out = [];
  for (const { name, args: target } of clausesOf(args)) {
    const value = target.length === 1 && isAtom(target[0]) ? target[0] : null;
    if (name === 'css-var' && value?.startsWith('--')) {
      out.push({ cssVar: value });
    } else if (name === 'data-attr' && value && /^[a-z][\w.-]*$/i.test(value)) {
      out.push({ dataAttr: value });
    } else {
      diagnostics.push(
        diagnostic(
          'bad-apply',
          'error',
          `${at.key}: apply needs (css-var --name) or (data-attr name)`,
          at
        )
      );
    }
  }
  return out;
}

function readNumber(field, name, args, diagnostics) {
  const n = args.length === 1 ? toNumber(args[0]) : NaN;
  if (Number.isFinite(n) && (name !== 'step' || n > 0)) {
    field[name] = n;
  } else {
    diagnostics.push(
      diagnostic('bad-number', 'error', `${field.key}: bad ${name}`, {
        key: field.key,
      })
    );
  }
}

/** Read one clause of a field; returns whether it was understood. */
function readClause(field, { name, args }, diagnostics) {
  if (NUMERIC.includes(name)) {
    readNumber(field, name, args, diagnostics);
  } else if (TEXT.includes(name) && text(args) !== undefined) {
    field[name] = text(args);
  } else if (name === 'options' && args.length > 0 && args.every(isAtom)) {
    field.options = [...args];
  } else if (name === 'apply') {
    field.apply.push(...readApply(args, { key: field.key }, diagnostics));
  } else if (name !== '' && !UNSAFE_KEYS.includes(name)) {
    field.props[name] = rawOf(args);
  } else {
    return false;
  }
  return true;
}

/** Read the clauses of a field into `field`; returns the raw default. */
function readClauses(field, clauses, diagnostics) {
  let raw;
  for (const clause of clauses) {
    if (clause.name === 'default') {
      raw = rawOf(clause.args);
    } else if (
      clause.name !== 'type' &&
      clause.name !== 'comfort' &&
      !readClause(field, clause, diagnostics)
    ) {
      diagnostics.push(
        diagnostic('bad-clause', 'warning', `${field.key}: unknown clause`, {
          key: field.key,
        })
      );
    }
  }
  return raw;
}

function checkShape(field, diagnostics) {
  const at = { key: field.key };
  if (field.type === 'range' && !(field.min <= field.max)) {
    diagnostics.push(
      diagnostic(
        'missing-range',
        'error',
        `${field.key}: a range needs (min …) <= (max …)`,
        at
      )
    );
    return false;
  }
  if (field.type === 'choice' && !field.options) {
    diagnostics.push(
      diagnostic(
        'missing-options',
        'error',
        `${field.key}: a choice needs (options …)`,
        at
      )
    );
    return false;
  }
  return true;
}

/** Whether a number is outside its range (a default is not clamped). */
function outOfRange(field, raw) {
  if (field.type !== 'range' && field.type !== 'number') {
    return false;
  }
  const n = toNumber(raw);
  return (
    (Number.isFinite(field.min) && n < field.min) ||
    (Number.isFinite(field.max) && n > field.max)
  );
}

function readDefault(field, raw, diagnostics) {
  const at = { key: field.key };
  if (raw === undefined) {
    diagnostics.push(
      diagnostic('missing-default', 'error', `${field.key}: no (default …)`, at)
    );
    return false;
  }
  const result = coerce(field, raw, {
    ...field.normalization,
    primitives: 'coerce',
  });
  if (!result.ok || outOfRange(field, raw)) {
    diagnostics.push(
      diagnostic(
        'bad-default',
        'error',
        `${field.key}: the default ${JSON.stringify(raw)} is not a valid ${field.type}`,
        at
      )
    );
    return false;
  }
  field.default = result.value;
  return true;
}

/**
 * @param {string} key
 * @param {LinkRecord['values']} values
 * @param {Diagnostic[]} diagnostics
 * @returns {SettingField|null}
 */
function readField(key, values, diagnostics, normalization) {
  const at = { key };
  const clauses = clausesOf(values);
  const typeClause = clauses.find((c) => c.name === 'type');
  const type = typeClause?.args.length === 1 ? typeClause.args[0] : undefined;
  if (!isAtom(type)) {
    diagnostics.push(
      diagnostic('missing-type', 'error', `${key}: no (type …)`, at)
    );
    return null;
  }
  if (!fieldType(type)) {
    diagnostics.push(
      diagnostic(
        'unknown-type',
        'error',
        `${key}: unknown type "${type}" (define it with defineFieldType)`,
        { key, type }
      )
    );
    return null;
  }
  /** @type {SettingField} */
  const field = {
    key,
    type,
    default: undefined,
    comfort: clauses.some((c) => c.name === 'comfort'),
    apply: [],
    props: {},
  };
  if (normalization) {
    field.normalization = normalization;
  }
  const raw = readClauses(field, clauses, diagnostics);
  if (
    !checkShape(field, diagnostics) ||
    !readDefault(field, raw, diagnostics)
  ) {
    return null;
  }
  return field;
}

function readSection(id, values) {
  const section = { id };
  for (const { name, args } of clausesOf(values)) {
    if (['label', 'description', 'level'].includes(name) && text(args)) {
      section[name] = text(args);
    } else if (name === 'tabs' && args.every(isAtom)) {
      section.tabs = [...args];
    }
  }
  return section;
}

function readPreset(id, values, fields, diagnostics) {
  const preset = { id, values: {} };
  for (const { name, args } of clausesOf(values)) {
    if ((name === 'label' || name === 'description') && text(args)) {
      preset[name] = text(args);
      continue;
    }
    const [key, ...rest] = args;
    const field = name === 'set' && isAtom(key) ? fields.get(key) : undefined;
    if (!field) {
      diagnostics.push(
        diagnostic(
          'unknown-key',
          'error',
          `preset ${id}: ${name === 'set' ? `unknown setting ${JSON.stringify(key)}` : `unknown clause "${name}"`}`,
          { preset: id, key }
        )
      );
      continue;
    }
    const result = coerce(field, rawOf(rest), {
      ...field.normalization,
      primitives: 'coerce',
    });
    if (!result.ok) {
      diagnostics.push(
        diagnostic('bad-value', 'error', `preset ${id}: bad value for ${key}`, {
          preset: id,
          key,
        })
      );
      continue;
    }
    if (field.comfort) {
      diagnostics.push(
        diagnostic(
          'preset-sets-comfort',
          'warning',
          `preset ${id}: ${key} is a comfort setting; the viewer's value is kept`,
          { preset: id, key }
        )
      );
    }
    preset.values[key] = result.value;
  }
  return preset;
}

function readMigrationClause(migration, name, args) {
  const atoms = args.every(isAtom);
  if ((name === 'from' || name === 'to') && args.length === 1) {
    const n = toNumber(args[0]);
    if (Number.isInteger(n)) {
      migration[name] = n;
      return true;
    }
  } else if (name === 'rename' && args.length === 2 && atoms) {
    migration.renames.push({ from: args[0], to: args[1] });
    return true;
  } else if (name === 'old-default' && args.length >= 2 && isAtom(args[0])) {
    migration.oldDefaults.push({ key: args[0], raw: rawOf(args.slice(1)) });
    return true;
  }
  return false;
}

function readMigration(values, fields, diagnostics) {
  const migration = { from: NaN, to: NaN, renames: [], oldDefaults: [] };
  for (const { name, args } of clausesOf(values)) {
    if (!readMigrationClause(migration, name, args)) {
      diagnostics.push(
        diagnostic('bad-migration', 'error', `migration: bad (${name} …)`)
      );
    }
  }
  if (!(migration.from < migration.to)) {
    diagnostics.push(
      diagnostic(
        'bad-migration',
        'error',
        'migration: needs (from N) (to M) with N < M'
      )
    );
    return null;
  }
  for (const { key } of migration.oldDefaults) {
    if (!fields.has(key)) {
      diagnostics.push(
        diagnostic(
          'unknown-key',
          'warning',
          `migration ${migration.from} → ${migration.to}: unknown setting ${key}`,
          { key }
        )
      );
    }
  }
  return migration;
}

function readVersion(values, diagnostics) {
  const clause = clausesOf(values).find((c) => c.name === 'version');
  const n = clause?.args.length === 1 ? toNumber(clause.args[0]) : NaN;
  if (Number.isInteger(n) && n >= 1) {
    return n;
  }
  diagnostics.push(
    diagnostic('bad-version', 'error', 'schema: needs (version N), N >= 1')
  );
  return 1;
}

function checkKey(key, seen, diagnostics, kind) {
  if (!key || UNSAFE_KEYS.includes(key)) {
    diagnostics.push(
      diagnostic('bad-key', 'error', `${kind}: bad id ${JSON.stringify(key)}`)
    );
    return false;
  }
  if (seen.has(key)) {
    diagnostics.push(
      diagnostic('duplicate-key', 'error', `${kind}: duplicate id "${key}"`, {
        key,
      })
    );
    return false;
  }
  seen.add(key);
  return true;
}

/** First pass: the version, sections and fields. */
function readDefinitions(heads, schema, diagnostics, options) {
  const seen = new Set();
  let hasVersion = false;
  for (const { kind, id, values } of heads) {
    if (kind === 'schema') {
      schema.version = readVersion(values, diagnostics);
      hasVersion = true;
    } else if (kind === 'section' && checkKey(id, seen, diagnostics, kind)) {
      schema.sections.push(readSection(id, values));
    } else if (kind === 'setting' && checkKey(id, seen, diagnostics, kind)) {
      const field = readField(id, values, diagnostics, options.normalization);
      if (field) {
        schema.fields.set(id, field);
      }
    } else if (kind === null) {
      diagnostics.push(
        diagnostic(
          'unknown-link',
          'warning',
          'A link that is not a schema, section, setting, preset or migration'
        )
      );
    }
  }
  if (!hasVersion) {
    diagnostics.push(
      diagnostic(
        'missing-schema-version',
        'warning',
        'No (id: schema (version N)) link; the version is 1'
      )
    );
  }
}

/** Second pass: presets and migrations, which refer to fields. */
function readReferences(heads, schema, diagnostics) {
  for (const { kind, id, values } of heads) {
    if (kind === 'preset') {
      if (!id || UNSAFE_KEYS.includes(id) || schema.presets.has(id)) {
        diagnostics.push(
          diagnostic(
            id ? 'duplicate-key' : 'bad-key',
            'error',
            `preset: bad or duplicate id ${JSON.stringify(id)}`
          )
        );
      } else {
        schema.presets.set(
          id,
          readPreset(id, values, schema.fields, diagnostics)
        );
      }
    } else if (kind === 'migration') {
      const migration = readMigration(values, schema.fields, diagnostics);
      if (migration) {
        schema.migrations.push(migration);
      }
    }
  }
}

function checkSections(schema, diagnostics) {
  const ids = new Set(schema.sections.map((s) => s.id));
  for (const field of schema.fields.values()) {
    if (field.section !== undefined && !ids.has(field.section)) {
      diagnostics.push(
        diagnostic(
          'unknown-section',
          'warning',
          `${field.key}: unknown section "${field.section}"`,
          { key: field.key, section: field.section }
        )
      );
    }
  }
}

/**
 * Read a settings schema. Never throws: problems (syntax errors, unknown
 * types, bad defaults, duplicate keys, …) are diagnostics, and the fields
 * that have errors are left out of the schema.
 * @param {string} text
 * @param {{ maxInputSize?: number }} [options]
 * @returns {{ schema: SettingsSchema, diagnostics: Diagnostic[] }}
 */
export function readSchema(text, options = {}) {
  const { records, diagnostics } = readRecords(text, options);
  /** @type {SettingsSchema} */
  const schema = {
    version: 1,
    fields: new Map(),
    sections: [],
    presets: new Map(),
    migrations: [],
  };
  if (records.length === 0 && diagnostics.length > 0) {
    // The text could not be read at all.
    return { schema, diagnostics };
  }
  const heads = records.map((record) => {
    const { kind, id, rest } = headOf(record);
    return { kind, id, values: record.values.slice(rest) };
  });
  readDefinitions(heads, schema, diagnostics, options);
  readReferences(heads, schema, diagnostics);
  checkSections(schema, diagnostics);
  schema.migrations.sort((a, b) => a.from - b.from);
  return { schema, diagnostics };
}

/**
 * The fields of a schema in order.
 * @param {SettingsSchema} schema
 */
export const fieldsOf = (schema) => [...schema.fields.values()];
