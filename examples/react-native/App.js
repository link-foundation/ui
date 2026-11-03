import { createElement, useState } from 'react';
import { SafeAreaView, Text, useColorScheme } from 'react-native';
import { createStore } from '../../packages/ui-store/src/store.js';
import { UiNativeView } from '../../packages/ui-react-native/src/index.js';
import source from '../../docs/case-studies/issue-1/samples/document.lino';

export default function App() {
  const dark = useColorScheme() === 'dark';
  const [store] = useState(() => createStore({ text: source }));
  const [status, setStatus] = useState('Ready');
  return createElement(
    SafeAreaView,
    {
      style: {
        flex: 1,
        backgroundColor: dark ? '#141218' : '#FFFBFE',
        padding: 24,
      },
    },
    createElement(
      Text,
      {
        accessibilityRole: 'header',
        style: {
          fontSize: 28,
          color: dark ? '#E6E1E5' : '#1C1B1F',
          marginBottom: 24,
        },
      },
      'Links UI · React Native'
    ),
    createElement(UiNativeView, {
      store,
      tokens: { 'space.medium': '16px' },
      styles: {
        greeting: { color: dark ? '#E6E1E5' : '#1C1B1F', fontSize: 20 },
        ok: {
          background: '#6750A4',
          color: '#FFFFFF',
          padding: '16px',
          radius: '12px',
        },
      },
      actions: {
        navigate: () => {
          store.setProp('greeting', 'value', ['Hello, native links']);
          setStatus('Navigated to home');
        },
      },
    }),
    createElement(
      Text,
      {
        accessibilityLiveRegion: 'polite',
        style: { marginTop: 24, color: dark ? '#E6E1E5' : '#1C1B1F' },
      },
      status
    )
  );
}
