/**
 * describeChanges: plain English lines for the overrides of the editable
 * layers, and config.explain for one property.
 */

import { describe, it, expect } from 'test-anywhere';
import { createConfig, describeChanges } from '@link-foundation/ui-config';
import { appDocument, fixture } from './helpers.js';

const USER_LINES = [
  "greeting: text changed from 'Hello, links' (site) to 'Hello, agents' (user)",
  'body: padding set to 16px (user)',
  "material3: token color.primary changed from '#6750A4' (site) to '#00639B' (user)",
];

describe('describeChanges', () => {
  it('describes the user layer against the layers below it', () => {
    const config = createConfig({ document: appDocument() });
    expect(describeChanges(config)).toEqual([]);
    config.importPatch(fixture('user.lino'));
    expect(describeChanges(config)).toEqual(USER_LINES);
  });

  it('names the winning layer and skips values that do not change', () => {
    const config = createConfig({ document: appDocument() });
    config.importPatch(fixture('user.lino'));
    config.set('session', 'ok', 'label', ['Go']);
    config.set('session', 'body', 'gap', [['token', 'space.large']]);
    config.set('session', 'greeting', 'text', ['Hello, links']);
    config.set('user', 'ok', 'variant', ['filled']);
    expect(describeChanges(config)).toEqual([
      USER_LINES[1],
      USER_LINES[2],
      'ok: label changed from OK (site) to Go (session)',
      'body: gap changed from (token space.medium) (site) to (token space.large) (session)',
    ]);
    expect(describeChanges(config, ['session'])).toEqual([
      'ok: label changed from OK (site) to Go (session)',
      'body: gap changed from (token space.medium) (site) to (token space.large) (session)',
      "greeting: text changed from 'Hello, agents' (user) to 'Hello, links' (session)",
    ]);
    expect(describeChanges(config, [])).toEqual([]);
  });

  it('describes theme and site patches too', () => {
    const config = createConfig({ document: appDocument() });
    config.loadLayer('theme', fixture('theme.lino'));
    config.loadLayer('site', fixture('site.lino'));
    expect(describeChanges(config, ['site'])).toEqual([
      'ok: variant changed from outlined (theme) to text (site)',
      'body: padding changed from 4px (theme) to 8px (site)',
      'body: gap set to (token space.large) (site)',
      "material3: token color.secondary set to '#625B71' (site)",
    ]);
  });
});
