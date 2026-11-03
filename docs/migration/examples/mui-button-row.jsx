import { Button, Stack } from '@mui/material';

export function ButtonRow({ saveDocument, cancel }) {
  return (
    <Stack direction="row" spacing={1}>
      <Button variant="contained" onClick={saveDocument}>
        Save
      </Button>
      <Button variant="text" onClick={cancel}>
        Cancel
      </Button>
    </Stack>
  );
}
