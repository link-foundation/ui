import { toDtcg } from '../export/dtcg.js';
import { checkedTokens } from './compile-css.js';

/** DTCG 2025.10 Resolver Module. Overlapping modes are explicit permutations. */
export function exportThemeResolver(theme) {
  const contexts = {};
  for (const [name, modes] of [
    ['light', []],
    ['dark', ['dark']],
    ['high-contrast', ['high-contrast']],
    ['dark-high-contrast', ['dark', 'high-contrast']],
  ]) {
    for (const reduced of [false, true]) {
      const active = [...modes, ...(reduced ? ['reduced'] : [])];
      contexts[name + (reduced ? '-reduced' : '')] = [
        toDtcg(checkedTokens(theme, active), { keepAliases: false }),
      ];
    }
  }
  return {
    $schema: 'https://www.designtokens.org/schemas/2025.10/resolver.json',
    version: '2025.10',
    name: theme.id,
    modifiers: { mode: { contexts, default: 'light' } },
    resolutionOrder: [{ $ref: '#/modifiers/mode' }],
  };
}
