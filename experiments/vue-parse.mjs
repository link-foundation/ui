// Dump parseVue output of a small SFC.
import { parseVue } from '../packages/ui-convert/src/vue/parse.js';
const src = `<template>
  <ul v-if="ok">
    <li v-for="(item, i) in todo.items" :key="item.id" @click.stop="pick">{{ item.text }} &amp; more</li>
  </ul>
  <p v-else>Empty</p>
</template>
<script setup lang="ts">
const a = 1 < 2;
</script>
<style scoped>.a { color: red }</style>`;
const r = parseVue(src);
console.log(JSON.stringify(r, null, 1));
