<script setup>
defineProps({ actions: { type: Object, default: () => ({}) } });
</script>
<template>
  <div id="app">
    <div id="body" class="ui-0">
      <p id="greeting">Hello, links</p>
      <button id="ok" class="ui-1" @click="actions['navigate']?.('home')">
        OK
      </button>
    </div>
  </div>
</template>
<style src="./App.css"></style>
