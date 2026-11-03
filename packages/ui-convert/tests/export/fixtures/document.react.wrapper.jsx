import { UiView } from '@link-foundation/ui-react';
const source = `app: document
  title 'Links UI demo'
  body: stack
    direction vertical
    gap
      token space.medium
    greeting: text 'Hello, links'
    ok: button
      label OK
      variant filled
      on press
        navigate home
`;
export function App({ actions = {} }) {
  return (
    <UiView source={source} actions={{ ['navigate']: () => {}, ...actions }} />
  );
}
