<Box sx={{ p: 2 }}>
  <Button {...buttonProps}>Spread</Button>
  <Button variant="contained" onClick={() => save(draft)}>Save</Button>
  <List>{items.map((item) => <ListItem key={item.id}>{item.name}</ListItem>)}</List>
</Box>
