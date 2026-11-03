// Type-check of the ui-components declaration files (icons, adapters, the
// combined entry point). Run from the repository root:
//   npx -p typescript@5 tsc --noEmit --strict --module nodenext \
//     --moduleResolution nodenext experiments/icons/types-check.ts

import {
  resolveIcon,
  registerIconSet,
  parseMachine,
  trapFocus,
  ICON_NAMES,
} from '@link-foundation/ui-components';
import { createLucideSource } from '@link-foundation/ui-components/icons/adapters/lucide';
import { createTablerSource } from '@link-foundation/ui-components/icons/adapters/tabler';
import {
  createMaterialSymbolsSource,
  MATERIAL_SYMBOLS_NOTICE,
} from '@link-foundation/ui-components/icons/adapters/material-symbols';
registerIconSet('lucide', createLucideSource());
const x: Promise<unknown> = resolveIcon('close');
void [
  x,
  parseMachine,
  trapFocus,
  ICON_NAMES,
  createTablerSource,
  createMaterialSymbolsSource,
  MATERIAL_SYMBOLS_NOTICE,
];
