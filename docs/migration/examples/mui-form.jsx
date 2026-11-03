import {
  Button,
  Checkbox,
  FormControlLabel,
  Stack,
  TextField,
} from '@mui/material';

export function ProfileFields({ saveProfile }) {
  return (
    <Stack spacing={2}>
      <TextField label="Email" name="email" type="email" required />
      <FormControlLabel
        control={<Checkbox name="updates" />}
        label="Email updates"
      />
      <Button variant="contained" onClick={saveProfile}>
        Save profile
      </Button>
    </Stack>
  );
}
