/**
 * Lottie interop: the lottie-spec examples round-trip, exports validate
 * against the official Lottie schema, and unsafe input (expressions, text,
 * images, effects) is rejected and never evaluated.
 */

import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { describe, it, expect } from 'test-anywhere';
import {
  LOTTIE_VERSION,
  decodePath,
  encodePath,
  exportLottie,
  importLottie,
  normalizeLottie,
  svgToBezier,
} from '../src/index.js';
import {
  PACKAGE_DIR,
  codes,
  errors,
  fixture,
  fixtureNames,
  fixtureText,
  reformat,
} from './helpers.js';

const require = createRequire(join(PACKAGE_DIR, 'package.json'));
const { Ajv2020 } = require('ajv/dist/2020');
const {
  LottieValidator,
  get_schema_path: getSchemaPath,
} = require('@lottie-animation-community/lottie-specs/src/validator-node.js');

const validator = new LottieValidator(
  Ajv2020,
  JSON.parse(readFileSync(getSchemaPath(), 'utf8'))
);

/** The schema errors (not warnings) of a Lottie animation. */
const schemaErrors = (json) =>
  validator.validate(json).filter((e) => e.type === 'error');

describe('Lottie fixtures', () => {
  for (const name of fixtureNames('lottie', ['rejected.json'])) {
    const input = fixture('lottie', name);
    const imported = importLottie(input);

    it(`${name}: export(import(x)) deep-equals normalizeLottie(x)`, () => {
      expect(errors(imported.diagnostics)).toEqual([]);
      const exported = exportLottie(imported.lino);
      expect(errors(exported.diagnostics)).toEqual([]);
      expect(exported.json).toEqual(normalizeLottie(input));
    });

    it(`${name}: serialize(parse(lino)) is stable`, () => {
      expect(reformat(imported.lino)).toBe(imported.lino);
    });

    it(`${name}: the export is valid against the Lottie schema`, () => {
      expect(schemaErrors(exportLottie(imported.lino).json)).toEqual([]);
    });
  }
});

describe('Lottie export of the issue example', () => {
  const lino = fixtureText('lottie', 'dot-pulse.lino');
  const { json, diagnostics } = exportLottie(lino, 'dot-pulse');

  it('writes a valid animation of the target element', () => {
    expect(LOTTIE_VERSION).toBe('1.0');
    expect(errors(diagnostics)).toEqual([]);
    expect(schemaErrors(json)).toEqual([]);
    expect(json.fr).toBe(60);
    expect(json.op).toBe(60);
    expect(json.layers.length).toBe(1);
  });

  it('turns the tracks into keyframes with the same timing', () => {
    const { o, p } = json.layers[0].ks;
    expect(o.k.map((k) => [k.t, k.s[0]])).toEqual([
      [0, 0],
      [30, 100],
      [60, 0],
    ]);
    expect(p.k.map((k) => [k.t, k.s])).toEqual([
      [0, [0, 0]],
      [60, [100, 0]],
    ]);
  });

  it('turns the shape into a path and a fill', () => {
    const [path, fill] = json.layers[0].shapes;
    expect(path.ty).toBe('sh');
    expect(path.ks.k.v).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(fill.ty).toBe('fl');
    expect(fill.c.k[0]).toBe(1);
  });

  it('round-trips through import', () => {
    const back = exportLottie(importLottie(json).lino);
    expect(back.json).toEqual(normalizeLottie(json));
  });
});

describe('Lottie rejected input', () => {
  const { lino, diagnostics } = importLottie(
    fixture('lottie', 'rejected.json')
  );

  it('reports every unsupported feature with a path', () => {
    expect(codes(errors(diagnostics)).sort()).toEqual([
      'effects',
      'expression',
      'nested-precomp',
      'unsupported-asset',
      'unsupported-layer',
      'unsupported-layer',
      'unsupported-layer',
    ]);
    const expression = diagnostics.find((d) => d.code === 'expression');
    expect(expression.at.path).toBe('/layers/1/ks/o/x');
  });

  it('drops expressions and keeps no text of them', () => {
    expect(lino).not.toContain('bm_rt');
    expect(lino).not.toContain('alert');
  });

  it('keeps the composition settings and the supported layers', () => {
    expect(lino).toContain('(frame-rate 30)');
    expect(lino).toContain('box: shape');
  });

  it('rejects JSON that is not a Lottie animation', () => {
    const out = importLottie({ layers: 'none' });
    expect(out.lino).toBe('');
    expect(errors(out.diagnostics).length).toBe(1);
  });
});

describe('Lottie paths', () => {
  it('converts SVG path data to Lottie bezier and back', () => {
    const bezier = svgToBezier('M0 0 L10 0 L10 10 Z');
    expect(bezier.c).toBe(true);
    expect(bezier.v).toEqual([
      [0, 0],
      [10, 0],
      [10, 10],
    ]);
    expect(decodePath(encodePath(bezier))).toEqual(bezier);
  });
});

describe('ui-convert source', () => {
  /** Every file under a directory, recursively. */
  const files = (dir) =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? files(join(dir, entry.name))
        : [join(dir, entry.name)]
    );

  it('never calls eval or new Function', () => {
    const pattern = new RegExp(['eval\\(', 'new Function'].join('|'));
    const hits = files(join(PACKAGE_DIR, 'src')).filter((file) =>
      pattern.test(readFileSync(file, 'utf8'))
    );
    expect(hits).toEqual([]);
  });
});
