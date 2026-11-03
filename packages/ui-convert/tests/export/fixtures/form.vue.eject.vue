<script setup>
defineProps({ actions: { type: Object, default: () => ({}) } });
</script>
<template>
  <form id="login" method="post">
    <label id="email-label" for="email">Email</label>
    <input id="email" type="text" name="email" placeholder="you@example.com" />
    <input id="remember" type="checkbox" name="remember" />
    <button id="ok">Sign in</button>
  </form>
</template>
<style src="./App.css"></style>
