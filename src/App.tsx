import { lazy, Suspense, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Box, Button, ThemeProvider, Typography } from '@mui/material';
import { createAppTheme } from './theme';
import { useMe } from './api/hooks';
import AuthPage from './pages/auth/AuthPage';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import useThemeStore from './store/themeStore';

// Pages
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Pomodoro = lazy(() => import('./pages/pomodoro/Pomodoro'));
const TaskList = lazy(() => import('./pages/tasks/TaskList'));
const Insights = lazy(() => import('./pages/insights/Insights'));
const Rewards = lazy(() => import('./pages/rewards/Rewards'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const Settings = lazy(() => import('./pages/settings/Settings'));

// Components
import Layout from './components/layout/Layout';

function App() {
  const darkMode = useThemeStore((state) => state.darkMode);

  const reducedMotion = useThemeStore((state) => state.reducedMotion);
  const theme = useMemo(() => createAppTheme(darkMode, reducedMotion), [darkMode, reducedMotion]);
  const { data: user, isLoading, isError, refetch, isRefetching } = useMe();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {isLoading ? (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center' }}>
          <CircularProgress />
        </Box>
      ) : isError ? (
        <Box sx={{ minHeight: '100vh', display: 'grid', placeItems: 'center', p: 3 }}>
          <Box sx={{ textAlign: 'center', maxWidth: 360 }}>
            <Typography variant="h5" gutterBottom>
              Can't reach the server
            </Typography>
            <Typography color="text.secondary" sx={{ mb: 3 }}>
              Check your connection. You stay signed in; your data is safe on the server.
            </Typography>
            <Button variant="contained" onClick={() => refetch()} disabled={isRefetching}>
              Try again
            </Button>
          </Box>
        </Box>
      ) : !user ? (
        <AuthPage />
      ) : (
        <Layout>
          <Suspense fallback={<CircularProgress sx={{ m: 4 }} />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/pomodoro" element={<Pomodoro />} />
              <Route path="/tasks" element={<TaskList />} />
              <Route path="/insights" element={<Insights />} />
              <Route path="/rewards" element={<Rewards />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Suspense>
        </Layout>
      )}
    </ThemeProvider>
  );
}

export default App;
