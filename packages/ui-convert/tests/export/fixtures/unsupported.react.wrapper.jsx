/* Unsupported kind spaceship on mystery for react */
/* Unsupported link destination moon on mystery for react */
/* Unsupported link magic sparkles on ok for react */
import { UiView } from '@link-foundation/ui-react';
const source = `app: document
  mystery: spaceship
    destination moon
    message: text 'Still here'
  ok: button
    label OK
    magic sparkles
`;
export function App({ actions = {} }) {
  return <UiView source={source} actions={{ ...actions }} />;
}
