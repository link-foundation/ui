<script setup>
import { computed } from 'vue';
import { UiView } from '@link-foundation/ui-vue';
const props = defineProps({ actions: { type: Object, default: () => ({}) } });
const source = `app: document
  title 'Links UI demo'
  body: stack
    direction vertical
    gap
      token space.medium
    greeting: text 'Hello, links'
    ok: button
      label OK
      variant filled
      on press
        navigate home
`;
const handlers = computed(() => ({ ['navigate']: () => {}, ...props.actions }));
</script>
<template><UiView :source="source" :actions="handlers" /></template>
