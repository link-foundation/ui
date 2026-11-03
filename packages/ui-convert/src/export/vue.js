import { templateString, stubs, wrapperComments } from './shared.js';
import { webEject } from './web.js';

export function vue(input) {
  const { source, actions, componentName, mode } = input;
  if (mode === 'eject') {
    return webEject(input, 'vue');
  }
  return [
    {
      path: `${componentName}.vue`,
      contents: `<script setup>
${wrapperComments(input)}
import { computed } from 'vue';
import { UiView } from '@link-foundation/ui-vue';
const props = defineProps({ actions: { type: Object, default: () => ({}) } });
const source = ${templateString(source)};
const handlers = computed(() => ({ ${stubs(actions)}, ...props.actions }));
</script>
<template><UiView :source="source" :actions="handlers" /></template>
`.replace('{ , ...props.actions }', '{ ...props.actions }'),
    },
  ];
}
