/**
 * importJsx: JSX / TSX -> UI dialect (fixtures, props, unsupported
 * expressions, spans, syntax errors).
 */

import { describe, it, expect } from 'test-anywhere';
import { importJsx, parseJsx } from '@link-foundation/ui-convert';
import { codes, componentFixtures, expectParses } from './helpers.js';

const lino = (text, options) => importJsx(text, options).text;

describe('importJsx fixtures', () => {
  for (const { file, source, lino: expected } of componentFixtures('jsx')) {
    it(`${file} gives its .lino`, () => {
      expect(importJsx(source).text).toBe(expected);
    });

    it(`${file}: the output parses with links-notation and ui-core`, () => {
      expectParses(importJsx(source).text);
    });

    it(`${file}: every span slices to the source of its element`, () => {
      const { spans, tree } = importJsx(source);
      expect(spans.size).toBe(tree.byId.size);
      for (const [id, { start, end }] of spans) {
        const slice = source.slice(start, end);
        if (id.startsWith('text-') && !slice.startsWith('<')) {
          expect(slice.trim()).toBe(tree.byId.get(id).positional[0]);
        } else {
          expect(slice.startsWith('<')).toBe(true);
          expect(slice.endsWith('>')).toBe(true);
        }
      }
    });
  }

  it('login.jsx is the example of the issue, without diagnostics', () => {
    const [{ source }] = componentFixtures('jsx').filter(
      (f) => f.file === 'login.jsx'
    );
    const { text, diagnostics, applied } = importJsx(source);
    expect(diagnostics).toEqual([]);
    expect(text).toContain('\n    on press\n      action signIn\n');
    expect([...applied.values()]).toEqual([
      'mui-stack-column',
      'mui-text-field',
      'mui-button-contained',
    ]);
  });

  it('unsupported.jsx: one diagnostic with a span per construct', () => {
    const [{ source }] = componentFixtures('jsx').filter(
      (f) => f.file === 'unsupported.jsx'
    );
    const { diagnostics } = importJsx(source);
    expect(codes(diagnostics)).toEqual([
      'unsupported-jsx-expression',
      'unsupported-jsx-expression',
      'unsupported-jsx-expression',
    ]);
    expect(
      diagnostics.map(({ span }) => source.slice(span.start, span.end))
    ).toEqual([
      '{...buttonProps}',
      'onClick={() => save(draft)}',
      '{items.map((item) => <ListItem key={item.id}>{item.name}</ListItem>)}',
    ]);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.severity).toBe('warning');
      expect(typeof diagnostic.message).toBe('string');
      expect(typeof diagnostic.id).toBe('string');
    }
  });
});

describe('importJsx props', () => {
  it('reads string, number and boolean props', () => {
    expect(lino('<TextField label="Name" rows={3} required />')).toBe(
      'text-field-0: text-field\n  label Name\n  required true\n  attr rows 3\n'
    );
  });

  it('turns an identifier handler into an action', () => {
    expect(lino('<Box onMouseEnter={show} />')).toBe(
      'box-0: box\n  on mouse-enter\n    action show\n'
    );
  });

  it('keeps a computed handler as unsupported', () => {
    const { text, diagnostics } = importJsx('<Box onClick={a.b} />');
    expect(text).toContain('\n  unsupported jsx-expression onClick={a.b}\n');
    expect(codes(diagnostics)).toEqual(['unsupported-jsx-expression']);
  });

  it('reads literal style and sx objects; style numbers get px', () => {
    expect(
      lino('<Box style={{ padding: 8, opacity: 0.5 }} sx={{ color: "red" }} />')
    ).toBe(
      'box-0: box\n  style\n    padding 8px\n    opacity 0.5\n    color red\n'
    );
  });

  it('keeps an sx object with a computed value as unsupported', () => {
    const { text, diagnostics } = importJsx(
      '<Box sx={{ color: (theme) => theme.palette.primary.main }} />'
    );
    expect(text).toContain('\n  unsupported jsx-expression ');
    expect(diagnostics[0].message).toContain('sx is not an object');
  });

  it('renames className and keeps it on HTML elements', () => {
    expect(lino('<div className="row"><p>Hi</p></div>')).toContain(
      '\n  attr class row\n'
    );
  });

  it('flattens fragments', () => {
    expect(lino('<><Box /><Box /></>')).toBe('box-0: box\nbox-1: box\n');
  });

  it('keeps unmatched components as (html (tag X)) with an info note', () => {
    const { text, diagnostics } = importJsx('<Avatar alt="Ann" />');
    expect(text).toBe('avatar-0: html\n  tag Avatar\n  attr alt Ann\n');
    expect(diagnostics.map((d) => [d.code, d.severity])).toEqual([
      ['unmapped-component', 'info'],
    ]);
  });

  it('drops script elements and event-handler strings', () => {
    const { text, diagnostics } = importJsx(
      '<div><script>alert(1)</script><a href="javascript:x()">x</a></div>'
    );
    expect(text).not.toContain('script');
    expect(text).not.toContain('javascript');
    expect(diagnostics.length).toBe(2);
    expectParses(text);
  });

  it('finds the JSX of a whole module, without running it', () => {
    const module = [
      "import { Button } from '@mui/material';",
      'export default function Save() {',
      '  return <Button variant="contained" onClick={save}>Save</Button>;',
      '}',
    ].join('\n');
    expect(lino(module)).toContain('button-0: button\n');
  });

  it('reads TSX type assertions around values', () => {
    expect(lino('<Box onClick={go as () => void} />')).toContain(
      '\n  on press\n    action go\n'
    );
  });
});

describe('importJsx errors', () => {
  it('reports a syntax error and still writes LiNo that parses', () => {
    const { text, diagnostics } = importJsx('<Box><Button></Box>');
    expect(codes(diagnostics)).toContain('syntax-error');
    expect(diagnostics[0].span.start >= 0).toBe(true);
    expectParses(text);
  });

  it('gives an empty document for text without JSX', () => {
    expect(importJsx('const x = 1;').text).toBe('');
  });

  it('rejects a non-string', () => {
    expect(() => importJsx(null)).toThrow(TypeError);
  });

  it('parseJsx gives spans of every element', () => {
    const root = parseJsx('<Box>\n  <Button>OK</Button>\n</Box>');
    const [box] = root.children;
    expect(box.span).toEqual({ start: 0, end: 34 });
    expect(box.children[0].tag).toBe('Button');
  });
});
