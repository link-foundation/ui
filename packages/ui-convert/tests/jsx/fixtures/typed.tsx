import { AppBar, IconButton, Switch, Toolbar, Typography } from '@mui/material';

interface HeaderProps {
  title: string;
  dark: boolean;
}

export function Header({ title, dark }: HeaderProps): JSX.Element {
  return (
    <AppBar position="static">
      <Toolbar>
        <IconButton aria-label="Open menu" onClick={openMenu as () => void} />
        <Typography variant="h6">Inbox</Typography>
        <Switch checked={true satisfies boolean} onChange={toggleDark!} />
      </Toolbar>
    </AppBar>
  );
}
