// @ts-self-types="./index.d.ts"
import { View, Text, Pressable, Image, ScrollView } from 'react-native';
import { createUiNativeView } from './UiNativeView.js';
export const UiNativeView = createUiNativeView({
  View,
  Text,
  Pressable,
  Image,
  ScrollView,
});
export { createUiNativeView };
export { mapElement } from './map.js';
export { toNativeStyle } from './style.js';
export { UiProvider } from '@link-foundation/ui-react/hooks';
