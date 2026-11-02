/**
 * JSON Forms interop: the official person and rule examples become forms
 * with one field per Control, rules become `(rule ...)`, and the forms
 * round-trip.
 */

import { describe, it, expect } from 'test-anywhere';
import {
  JSON_FORMS_VERSION,
  bindToScope,
  exportJsonForms,
  importJsonForms,
  normalizeJsonForms,
  scopeToBind,
} from '../src/index.js';
import {
  codes,
  errors,
  fixture,
  fixtureNames,
  parseLino,
  reformat,
} from './helpers.js';

/** Every element of a tree, depth first. */
const walk = (nodes) => nodes.flatMap((n) => [n, ...walk(n.children)]);

/** The elements of an import by id. */
const elementsOf = (input) =>
  new Map(
    walk(parseLino(importJsonForms(input).lino).roots)
      .filter((n) => n.id)
      .map((n) => [n.id, n])
  );

/** The values of the first property `name` of a node. */
const prop = (node, name) =>
  node.properties.find((p) => p.name === name)?.values;

describe('JSON Forms fixtures', () => {
  for (const name of fixtureNames('json-forms')) {
    const input = fixture('json-forms', name);
    const imported = importJsonForms(input);

    it(`${name}: export(import(x)) deep-equals normalizeJsonForms(x)`, () => {
      expect(errors(imported.diagnostics)).toEqual([]);
      const exported = exportJsonForms(imported.lino);
      expect(errors(exported.diagnostics)).toEqual([]);
      expect(normalizeJsonForms(exported.json)).toEqual(
        normalizeJsonForms(input)
      );
    });

    it(`${name}: serialize(parse(lino)) is stable`, () => {
      expect(parseLino(imported.lino).diagnostics).toEqual([]);
      expect(reformat(imported.lino)).toBe(imported.lino);
    });
  }
});

describe('JSON Forms person example', () => {
  const person = fixture('json-forms', 'person.json');
  const elements = elementsOf(person);
  const flat = (e) => [e, ...(e.elements ?? []).flatMap(flat)];
  const controls = flat(person.uischema).filter((e) => e.type === 'Control');

  it('makes one field per Control with its data binding', () => {
    expect(controls.length).toBe(6);
    for (const control of controls) {
      const bind = scopeToBind(control.scope);
      const field = [...elements.values()].find(
        (n) => prop(n, 'bind')?.[0] === bind
      );
      expect(field).toBeTruthy();
      expect(bindToScope(bind)).toBe(control.scope);
    }
  });

  it('maps types, required, limits, enums and descriptions', () => {
    expect(elements.get('name').kind).toBe('text-field');
    expect(prop(elements.get('name'), 'min-length')).toEqual(['3']);
    expect(prop(elements.get('name'), 'description')).toEqual([
      'Please enter your name',
    ]);
    expect(elements.get('age').kind).toBe('number-field');
    expect(prop(elements.get('age'), 'type')).toEqual(['integer']);
    expect(prop(elements.get('age'), 'required')).toEqual(['true']);
    expect(prop(elements.get('name'), 'required')).toBeUndefined();
    expect(elements.get('birthDate').kind).toBe('date-field');
    const nationality = elements.get('nationality');
    expect(nationality.kind).toBe('select');
    expect(
      nationality.properties
        .filter((p) => p.name === 'option')
        .map((p) => p.values[0])
    ).toEqual(['DE', 'IT', 'JP', 'US', 'RU', 'Other']);
    expect(prop(nationality, 'required')).toEqual(['true']);
  });

  it('keeps unbound schema properties and the data in extra', () => {
    const { lino, diagnostics } = importJsonForms(person);
    expect(codes(diagnostics)).toEqual(['unbound-schema']);
    expect(lino).toContain('"drivingSkill"');
    expect(lino).toContain('"John Doe"');
  });
});

describe('JSON Forms rules', () => {
  const elements = elementsOf(fixture('json-forms', 'rule.json'));
  const rule = (id) => prop(elements.get(id), 'rule');

  it('turns a HIDE rule into (rule (hide ...))', () => {
    expect(rule('kindOfVegetables')).toEqual([
      ['hide', ['when', ['bind', 'vegetables'], ['equals', 'false']]],
      ['target', 'kindOfVegetables'],
    ]);
  });

  it('turns an ENABLE rule into (rule (enable ...))', () => {
    expect(rule('kindOfDead')[0][0]).toBe('enable');
  });

  it('keeps a rule it cannot express as JSON, with a warning', () => {
    const { diagnostics } = importJsonForms(fixture('json-forms', 'rule.json'));
    expect(codes(diagnostics)).toEqual(['unsupported-rule']);
    expect(rule('vitaminDeficiency')[0][0]).toBe('json');
  });

  it('reads one-of conditions and layout rules', () => {
    const { lino } = importJsonForms(
      fixture('json-forms', 'categorization.json')
    );
    expect(lino).toContain(
      '(rule (disable (when (bind diet) (one-of vegan pescatarian))))'
    );
  });
});

describe('JSON Forms scopes', () => {
  it('converts scopes and binds both ways', () => {
    expect(JSON_FORMS_VERSION).toBe('3');
    expect(scopeToBind('#/properties/personalData/properties/age')).toBe(
      'personalData.age'
    );
    expect(bindToScope('personalData.age')).toBe(
      '#/properties/personalData/properties/age'
    );
  });

  it('keeps unknown UI schema keys in extra', () => {
    const input = {
      schema: { type: 'object', properties: { a: { type: 'string' } } },
      uischema: { type: 'Control', scope: '#/properties/a', future: [1] },
    };
    const { lino } = importJsonForms(input);
    expect(lino).toContain('(extra json-forms');
    expect(normalizeJsonForms(exportJsonForms(lino).json)).toEqual(
      normalizeJsonForms(input)
    );
  });

  it('never follows a scope that names __proto__ or constructor', () => {
    // JSON.parse makes "__proto__" an own key, as untrusted input would.
    const input = JSON.parse(`{
      "schema": { "type": "object", "properties": {
        "__proto__": { "type": "string", "minLength": 2 },
        "name": { "type": "string" } } },
      "uischema": { "type": "VerticalLayout", "elements": [
        { "type": "Control", "scope": "#/properties/__proto__" },
        { "type": "Control", "scope": "#/properties/constructor" },
        { "type": "Control", "scope": "#/properties/name" } ] }
    }`);
    const prototypeKeys = Object.getOwnPropertyNames(Object.prototype);
    const { lino, diagnostics } = importJsonForms(input);
    expect(codes(diagnostics)).toEqual([
      'unsafe-path',
      'unsafe-path',
      'unbound-schema',
    ]);
    expect(diagnostics[0].at.path).toBe('/uischema/elements/0/scope');
    expect(lino).toContain(`(bind '#/properties/__proto__')`);
    const out = exportJsonForms(lino);
    expect(errors(out.diagnostics)).toEqual([]);
    // Compared as text, because toEqual skips an own "__proto__" key.
    expect(JSON.stringify(out.json)).toBe(JSON.stringify(input));
    expect(Object.getOwnPropertyNames(Object.prototype)).toEqual(prototypeKeys);
  });
});
