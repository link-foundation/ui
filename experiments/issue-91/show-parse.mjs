// Print the links `links-notation` returns for each .lino file given.
import { readFileSync } from 'node:fs';
import { Parser } from 'links-notation';

for (const file of process.argv.slice(2)) {
  const links = new Parser().parse(readFileSync(file, 'utf8'));
  console.log(file);
  for (const link of links) {
    console.log('  ', link.format());
  }
}
