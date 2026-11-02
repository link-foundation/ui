// How links-notation 0.27.1 returns the three document forms.
import { Parser } from 'links-notation';
const p = new Parser();
const show = (t) => {
  console.log('---', JSON.stringify(t));
  try {
    console.log(
      'parse:',
      p
        .parse(t)
        .map((l) => l.format())
        .join(' | ')
    );
    console.log(
      'groups:',
      JSON.stringify(
        p
          .parseGroups(t)
          .map((g) => `${g.element.format()} kids=${g.children.length}`)
      )
    );
  } catch (e) {
    console.log('ERR', e.message);
  }
};
show("(ok: button (label 'OK') (variant filled))");
show("(ok: button\n  (label 'OK')\n  (variant filled))");
show("(ok: button\n  (label 'OK')   \n  (variant filled))");
show("ok: button\n  label 'OK'\n  variant filled\n");
show("ok: button 'x'\n  label 'OK'\n  child: text 'a'\n    variant filled\n");
show('(a: b\n  (c: d\n    (e f))\n  (g h))');
show('(a: b (c d)\n  (g h))');
show('(a: b\n\n  (g h)\n)');
show('ok:\n  button\n');
