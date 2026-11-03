import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';

export function SavedDialog({ close }) {
  return (
    <Dialog open onClose={close}>
      <DialogTitle>Profile saved</DialogTitle>
      <DialogContent>Your changes are available on this device.</DialogContent>
      <DialogActions>
        <Button onClick={close}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
