<template>
  <Card>
    <Typography v-show="visible" variant="h6">Profile</Typography>
    <Typography variant="body1">Hello, {{ user.name }}</Typography>
    <TextField v-model.trim="draft.name" label="Name" />
    <Button variant="contained" @click="save(draft)">Save</Button>
    <Button variant="text" @click.prevent="cancel">Cancel</Button>
  </Card>
</template>
