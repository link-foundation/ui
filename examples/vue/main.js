// Usage of @link-foundation/ui-vue in a Vite + Vue 3 app: the issue-1 sample
// document in a store shared through the plugin, rendered by UiView, with a
// `chart` element drawn by a Vue component.
// npm --prefix examples/vue install && npm --prefix examples/vue run dev
import { createApp } from 'vue';
import { createUiPlugin, storeFromSource } from '@link-foundation/ui-vue';
import documentText from '../../docs/case-studies/issue-1/samples/document.lino?raw';
import App from './App.vue';

const store = storeFromSource(documentText, {
  onDiagnostic: (d) => console.info('ui-vue diagnostic', d.message),
});
// `chart` is not a dialect kind: the `components` prop of UiView draws it.
store.insert('body', undefined, {
  id: 'sales',
  kind: 'chart',
  properties: [
    { name: 'title', values: ['Links per day'] },
    { name: 'values', values: ['3', '5', '2', '6', '4'] },
  ],
});

createApp(App, { store })
  .use(
    createUiPlugin({
      store,
      actions: { navigate: (detail) => console.info('navigate', detail) },
    })
  )
  .mount('#app');
