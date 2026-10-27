import { useState, type FormEvent } from 'react';
import { Alert, Box, Button, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';
import { BoltRounded as LogoIcon } from '@mui/icons-material';
import { useLogin, useRegister } from '../../api/hooks';

type Mode = 'login' | 'register';

const AuthPage = () => {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const login = useLogin();
  const register = useRegister();
  const active = mode === 'login' ? login : register;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (mode === 'login') login.mutate({ email, password });
    else register.mutate({ email, password, displayName: displayName || undefined });
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 2 }}>
      <Paper sx={{ width: '100%', maxWidth: 420, p: { xs: 3, sm: 4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 3 }}>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2.5,
              display: 'grid',
              placeItems: 'center',
              color: '#fff',
              background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            }}
          >
            <LogoIcon />
          </Box>
          <Typography variant="h5">ADHD Focus</Typography>
        </Box>

        <Tabs
          value={mode}
          onChange={(_, v: Mode) => {
            setMode(v);
            login.reset();
            register.reset();
          }}
          variant="fullWidth"
          sx={{ mb: 3 }}
        >
          <Tab label="Sign in" value="login" />
          <Tab label="Create account" value="register" />
        </Tabs>

        <Box component="form" onSubmit={submit} sx={{ display: 'grid', gap: 2 }}>
          {mode === 'register' && (
            <TextField
              label="Display name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              inputProps={{ maxLength: 60 }}
              autoComplete="nickname"
            />
          )}
          <TextField
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />
          <TextField
            label="Password"
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            helperText={mode === 'register' ? 'At least 8 characters' : undefined}
            inputProps={{ minLength: mode === 'register' ? 8 : undefined }}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {active.isError && <Alert severity="error">{active.error.message}</Alert>}
          <Button type="submit" variant="contained" size="large" disabled={active.isPending}>
            {mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
};

export default AuthPage;
