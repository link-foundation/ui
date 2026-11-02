// Print the @vue/compiler-dom AST of a small SFC (to design src/vue/parse.js).
import { parse } from '@vue/compiler-dom';
const src = `<template>
  <div class="a" :title="t" @click="save" v-if="ok" v-for="(item, i) in items" :key="item.id" v-model="draft.text" #default>
    Hi {{ name }} &amp; you<MyComp/>
  </div>
  <p v-else>no</p>
</template>
<script setup lang="ts">
const a = 1 < 2;
</script>
<style scoped>.a { color: red }</style>`;
const ast = parse(src, { parseMode: 'sfc' });
const strip = (n) => {
  if (Array.isArray(n)) {
    return n.map(strip);
  }
  if (!n || typeof n !== 'object') {
    return n;
  }
  const o = {};
  for (const [k, v] of Object.entries(n)) {
    if (k === 'loc') {
      o.loc = [v.start.offset, v.end.offset];
      continue;
    }
    if (
      [
        'codegenNode',
        'helpers',
        'components',
        'directives',
        'hoists',
        'imports',
        'cached',
        'temps',
        'source',
      ].includes(k)
    ) {
      continue;
    }
    o[k] = strip(v);
  }
  return o;
};
console.log(JSON.stringify(strip(ast.children), null, 1));
