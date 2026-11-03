import { UiView } from '@link-foundation/ui-react';
const source = `login: html
  tag form
  attr method post
  email-label: text Email
    tag label
    attr for email
  email: text-field
    attr type text
    attr name email
    attr placeholder you@example.com
  remember: checkbox
    attr type checkbox
    attr name remember
  ok: button
    label 'Sign in'
`;
export function App({ actions = {} }) {
  return <UiView source={source} actions={{ ...actions }} />;
}
