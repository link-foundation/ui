/** Rebuild the site's initial example files from the #34 component stories. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import {
  parseStories,
  storiesDocument,
  controlKindNames,
} from '@link-foundation/ui-components/controls';
import { parse, format } from '@link-foundation/ui-core';
for (const kind of controlKindNames()) {
  const set = parseStories(
    await readFile(`packages/ui-components/stories/${kind}.lino`, 'utf8')
  );
  const directory = `packages/site/content/examples/${kind}`;
  await mkdir(directory, { recursive: true });
  for (const story of set.stories) {
    const text = format(
      parse(storiesDocument([{ ...set, stories: [story] }], { id: 'demo' }))
    );
    await writeFile(`${directory}/${story.name}.lino`, text);
  }
}
