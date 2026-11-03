import { createElement } from 'react';
import { createUiNativeView } from '../src/UiNativeView.js';
export const primitives = Object.fromEntries(
  ['View', 'Text', 'Pressable', 'Image', 'ScrollView'].map((name) => [
    name,
    name,
  ])
);
export const UiNativeView = createUiNativeView(primitives);
export { createElement };
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
