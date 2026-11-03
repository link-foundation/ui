import { templateString, stubs, wrapperComments } from './shared.js';
import { webEject } from './web.js';

export function react(input) {
  const { source, actions, componentName, mode } = input;
  if (mode === 'eject') {
    return webEject(input, 'react');
  }
  return [
    {
      path: `${componentName}.jsx`,
      contents: `${wrapperComments(input)}
import { UiView } from '@link-foundation/ui-react';
const source = ${templateString(source)};
export function ${componentName}({ actions = {} }) {
  return <UiView source={source} actions={{ ${stubs(actions)}, ...actions }} />;
}
`.replace('{ , ...actions }', '{ ...actions }'),
    },
  ];
}
