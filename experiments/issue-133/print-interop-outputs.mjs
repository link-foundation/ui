// Print the nested LiNo that the interop importers write for the inputs of
// the interop tests (#133), to update their expectations.
import {
  importA2ui,
  importAdaptiveCard,
  importJsonForms,
  importLottie,
} from '../../packages/ui-convert/src/index.js';
import { fixture } from '../../packages/ui-convert/tests/helpers.js';

const grep = (label, text, pattern) =>
  console.log(
    `=== ${label}\n${text
      .split('\n')
      .map((line, i, all) => [line, all[i + 1] ?? '', all[i + 2] ?? ''])
      .filter(([line]) => pattern.test(line))
      .map((lines) => lines.join('\n'))
      .join('\n--\n')}`
  );

const create = {
  version: 'v0.9',
  createSurface: { surfaceId: 's', catalogId: 'c' },
};
const a2ui = importA2ui([
  create,
  {
    version: 'v0.9',
    updateComponents: {
      surfaceId: 's',
      components: [
        { id: 'root', component: 'Text', text: 'Hi', future: { a: [1, 2] } },
      ],
    },
  },
]);
grep('a2ui', a2ui.lino, /extra/);
const card = importAdaptiveCard({
  type: 'AdaptiveCard',
  version: '1.6',
  body: [{ type: 'TextBlock', text: 'Hi', futureStyle: { glow: true } }],
});
grep('adaptive', card.lino, /extra/);
grep(
  'json-forms rule',
  importJsonForms(fixture('json-forms', 'categorization.json')).lino,
  /one-of|rule$/
);
grep(
  'json-forms extra',
  importJsonForms({
    schema: { type: 'object', properties: { a: { type: 'string' } } },
    uischema: { type: 'Control', scope: '#/properties/a', future: [1] },
  }).lino,
  /extra/
);
grep(
  'json-forms proto',
  importJsonForms(
    JSON.parse(`{"schema":{"type":"object","properties":{"__proto__":{"type":"string"}}},
    "uischema":{"type":"VerticalLayout","elements":[{"type":"Control","scope":"#/properties/__proto__"}]}}`)
  ).lino,
  /__proto__/
);
grep(
  'lottie rejected',
  importLottie(fixture('lottie', 'rejected.json')).lino,
  /frame-rate/
);
