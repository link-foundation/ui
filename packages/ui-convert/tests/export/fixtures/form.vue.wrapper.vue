<script setup>
import { computed } from 'vue';
import { UiView } from '@link-foundation/ui-vue';
const props = defineProps({ actions: { type: Object, default: () => ({}) } });
const source = `login: html
  tag form
  attr method post
  email-label: text Email
    tag label
    attr for email
  email: text-field
    attr type text
    attr name email
    attr placeholder you@example.com
  remember: checkbox
    attr type checkbox
    attr name remember
  ok: button
    label 'Sign in'
`;
const handlers = computed(() => ({ ...props.actions }));
</script>
<template><UiView :source="source" :actions="handlers" /></template>
