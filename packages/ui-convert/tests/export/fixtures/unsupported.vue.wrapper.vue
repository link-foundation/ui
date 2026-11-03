<script setup>
/* Unsupported kind spaceship on mystery for vue */
/* Unsupported link destination moon on mystery for vue */
/* Unsupported link magic sparkles on ok for vue */
import { computed } from 'vue';
import { UiView } from '@link-foundation/ui-vue';
const props = defineProps({ actions: { type: Object, default: () => ({}) } });
const source = `app: document
  mystery: spaceship
    destination moon
    message: text 'Still here'
  ok: button
    label OK
    magic sparkles
`;
const handlers = computed(() => ({ ...props.actions }));
</script>
<template><UiView :source="source" :actions="handlers" /></template>
