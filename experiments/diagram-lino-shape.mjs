// Prints the links-notation parse tree of the issue-40 login-flow diagram.
import { Parser } from 'links-notation';
const text = `(login-flow: diagram
  (kind flowchart)
  (direction down)
  (start: node (label 'Start'))
  (check: node (label 'Signed in?') (shape diamond))
  (home: node (label 'Home'))
  (edge (from start) (to check))
  (edge (from check) (to home) (label 'yes')))`;
const links = new Parser().parse(text);
console.log(JSON.stringify(links, null, 1));
console.log(links.map(String).join('\n'));
