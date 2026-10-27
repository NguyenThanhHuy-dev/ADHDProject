import { lazy, Suspense, useMemo } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { createAppTheme } from './theme';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import useThemeStore from './store/themeStore';

// Pages
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'));
const Pomodoro = lazy(() => import('./pages/pomodoro/Pomodoro'));
const TaskList = lazy(() => import('./pages/tasks/TaskList'));
const Rewards = lazy(() => import('./pages/rewards/Rewards'));
const Profile = lazy(() => import('./pages/profile/Profile'));
const Settings = lazy(() => import('./pages/settings/Settings'));

// Components
import Layout from './components/layout/Layout';

function App() {
  const darkMode = useThemeStore((state) => state.darkMode);

  const theme = useMemo(() => createAppTheme(darkMode), [darkMode]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Layout>
        <Suspense fallback={<CircularProgress sx={{ m: 4 }} />}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/pomodoro" element={<Pomodoro />} />
            <Route path="/tasks" element={<TaskList />} />
            <Route path="/rewards" element={<Rewards />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </Suspense>
      </Layout>
    </ThemeProvider>
  );
}

export default App;
