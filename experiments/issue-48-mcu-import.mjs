// Reproduce the 0.4.0 published ESM failure through the package entry point.
// First install that version into the ui-themes workspace to compare it with 0.3.0.
import { materialThemeFromSeed } from '../packages/ui-themes/src/material3/seed.js';
console.log(materialThemeFromSeed('#6750A4').length);
