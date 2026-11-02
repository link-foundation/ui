/**
 * checkHardcodedText: string literals in text props of a document that
 * declares `(i18n required)`, read with ui-core `parse`.
 */

import { describe, it, expect } from 'test-anywhere';
import { checkHardcodedText, HARDCODED_TEXT } from '@link-foundation/ui-i18n';
import { fixture } from './helpers.js';

const required = (body) => `(app: document (i18n required) ${body})`;

describe('checkHardcodedText', () => {
  it('flags (label "OK") under (i18n required) once', () => {
    const diagnostics = checkHardcodedText(
      required("(ok: button (label 'OK'))")
    );
    expect(diagnostics.length).toBe(1);
    expect(diagnostics[0].code).toBe(HARDCODED_TEXT);
    expect(diagnostics[0].severity).toBe('error');
    expect(diagnostics[0].at).toEqual({ element: 'ok', property: 'label' });
    expect(diagnostics[0].value).toBe('OK');
  });

  it('accepts (label (t ok.label))', () => {
    expect(
      checkHardcodedText(required('(ok: button (label (t ok.label)))'))
    ).toEqual([]);
    expect(checkHardcodedText(fixture('document.lino'))).toEqual([]);
  });

  it('ignores documents without (i18n required)', () => {
    expect(
      checkHardcodedText("(app: document (ok: button (label 'OK')))")
    ).toEqual([]);
    expect(
      checkHardcodedText(
        "(app: document (i18n optional) (ok: button (label 'OK')))"
      )
    ).toEqual([]);
  });

  it('flags positional text of text kinds and labelled elements', () => {
    const diagnostics = checkHardcodedText(
      required("(ok: button 'OK') (hi: text 'Hi') (n: text 42) (x: text (t x))")
    );
    expect(diagnostics.map((d) => d.at.element)).toEqual(['ok', 'hi']);
  });

  it('flags other text props and nested elements, not numbers or symbols', () => {
    const diagnostics = checkHardcodedText(
      required(
        "(form: container (name: input (placeholder 'Your name') (title '42')) (s: button (label '✓')))"
      )
    );
    expect(diagnostics.map((d) => [d.at.element, d.at.property])).toEqual([
      ['name', 'placeholder'],
    ]);
  });

  it('takes custom text props', () => {
    const doc = required("(ok: button (label 'OK') (title 'Tip'))");
    expect(
      checkHardcodedText(doc, { textProps: ['title'] }).map(
        (d) => d.at.property
      )
    ).toEqual(['title']);
  });

  it('reports parse errors of a document that requires i18n', () => {
    const diagnostics = checkHardcodedText(
      required("(a: button (label 'A')) (a: button)")
    );
    expect(diagnostics.map((d) => d.code).sort()).toEqual([
      'duplicate-id',
      HARDCODED_TEXT,
    ]);
  });
});
