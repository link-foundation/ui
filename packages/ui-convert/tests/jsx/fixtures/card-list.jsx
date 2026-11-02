<Card>
  <CardContent>
    <Typography variant="h5">Today</Typography>
    <List>
      <ListItem>Buy milk</ListItem>
      <ListItem className="done">Write the report</ListItem>
    </List>
    <Stack direction="row" spacing={1}>
      <Button variant="outlined" onClick={clearDone}>
        Clear
      </Button>
      <Button variant="text" disabled>
        Archive
      </Button>
    </Stack>
  </CardContent>
</Card>
