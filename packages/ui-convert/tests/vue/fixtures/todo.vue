<template>
  <Stack direction="column" spacing="2">
    <Typography variant="h1">Todo</Typography>
    <List v-if="todo.items">
      <ListItem v-for="(item, i) in todo.items" :key="item.id">
        <Checkbox :checked="item.done" :label="'Done'" />
      </ListItem>
    </List>
    <Typography v-else variant="body2">Nothing to do</Typography>
    <TextField label="New item" v-model="draft.text" />
    <Button variant="contained" @click="addItem">Add</Button>
  </Stack>
</template>

<script setup>
import { ref } from 'vue';

const draft = ref({ text: '' });
function addItem() {}
</script>

<style scoped>
.todo { padding: 8px; }
</style>
