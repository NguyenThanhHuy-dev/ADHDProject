import React, { useState } from 'react';
import {
  Grid,
  useTheme,
  Paper,
  Typography,
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import {
  Help as HelpIcon,
  TaskAltRounded,
  PendingActionsRounded,
  StarRounded,
  TimerOutlined,
} from '@mui/icons-material';
import StatCard from '../../components/StatCard';
import useTaskStore from '../../store/taskStore';
import usePomodoroStore from '../../store/pomodoroStore';
import useRewardStore from '../../store/rewardStore';

const shortDate = (d: string) =>
  new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function Dashboard() {
  const theme = useTheme();
  const [showHelp, setShowHelp] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const tasks = useTaskStore((state) => state.tasks);
  const sessions = usePomodoroStore((state) => state.sessions);
  const points = useRewardStore((state) => state.points);
  const streakInfo = usePomodoroStore((state) => state.getStreakInfo());

  const completedTasks = tasks.filter((task) => task.completed);
  const pendingTasks = tasks.filter((task) => !task.completed);

  const recentSessions = sessions.slice(-5).reverse();

  const tutorialSteps = [
    {
      label: 'Daily Concentration Streak',
      description:
        'Maintain a daily concentration streak by completing at least 60 minutes of focused work each day. Your streak increases with each consecutive day you meet this goal.',
    },
    {
      label: 'Streak Rewards',
      description:
        'Earn bonus points for maintaining your streak! 2 consecutive days = 20 points, 3 days = 30 points, and so on. The longer your streak, the more points you earn.',
    },
    {
      label: 'Keeping Your Streak',
      description:
        'Your streak continues as long as you maintain at least 60 minutes of concentration each day. Missing a day or not reaching 60 minutes will reset your streak.',
    },
    {
      label: 'Tracking Progress',
      description:
        'Monitor your streak and daily concentration time in the Dashboard. The concentration chart shows your daily focus time, and the streak counter shows your current streak.',
    },
  ];

  // Group completed tasks by date
  const tasksByDate = completedTasks.reduce(
    (acc, task) => {
      const date = new Date(task.completedAt ?? task.createdAt).toLocaleDateString();
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Group concentration time by date
  const concentrationByDate = sessions.reduce(
    (acc, session) => {
      const date = new Date(session.startTime).toLocaleDateString();
      const duration = Number(session.duration) || 0;
      acc[date] = (acc[date] || 0) + duration;
      return acc;
    },
    {} as Record<string, number>,
  );

  // Convert to array format for the charts
  const taskChartData = Object.entries(tasksByDate)
    .map(([date, count]) => ({
      date,
      count,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  const concentrationChartData = Object.entries(concentrationByDate)
    .map(([date, minutes]) => ({
      date,
      minutes,
      hours: (minutes / 60).toFixed(1),
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(-7);

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  const chartAxis = { fontSize: 12, fill: theme.palette.text.secondary };
  const chartTooltip = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(15,23,42,0.12)',
    color: theme.palette.text.primary,
  };
  const streakActive = streakInfo.currentStreak >= 2;
  const totalFocusHours = (
    concentrationChartData.reduce((sum, d) => sum + d.minutes, 0) / 60
  ).toFixed(1);

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Dashboard</Typography>
          <Typography variant="body2" color="text.secondary">
            Your focus and progress at a glance
          </Typography>
        </Box>
        <Tooltip title="Help">
          <IconButton onClick={() => setShowHelp(true)} aria-label="Help">
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper
            sx={{
              p: { xs: 3, md: 4 },
              border: 'none',
              color: '#fff',
              position: 'relative',
              overflow: 'hidden',
              background: streakActive
                ? 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 120%)'
                : 'linear-gradient(135deg, #334155 0%, #1e293b 100%)',
              '&::after': {
                content: '""',
                position: 'absolute',
                inset: 0,
                background:
                  'radial-gradient(circle at 90% 0%, rgba(255,255,255,0.22) 0%, transparent 55%)',
                pointerEvents: 'none',
              },
            }}
          >
            <Box
              sx={{
                position: 'relative',
                zIndex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 3,
                flexWrap: 'wrap',
              }}
            >
              <Box>
                <Typography variant="overline" sx={{ opacity: 0.85, letterSpacing: '0.08em' }}>
                  Concentration streak
                </Typography>
                <Typography variant="h2" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
                  {streakInfo.currentStreak} {streakInfo.currentStreak === 1 ? 'day' : 'days'}
                </Typography>
                <Typography sx={{ opacity: 0.9, maxWidth: 420 }}>
                  {streakActive
                    ? `Keep it going: your next streak reward is ${streakInfo.currentStreak * 10} points.`
                    : 'Complete 60 minutes of focused work today to start your streak.'}
                </Typography>
              </Box>
              <Box
                aria-hidden
                sx={{
                  display: { xs: 'none', sm: 'grid' },
                  width: 112,
                  height: 112,
                  borderRadius: '50%',
                  placeItems: 'center',
                  fontSize: 44,
                  fontWeight: 800,
                  bgcolor: 'rgba(255,255,255,0.16)',
                  border: '2px solid rgba(255,255,255,0.45)',
                  backdropFilter: 'blur(6px)',
                }}
              >
                {streakInfo.currentStreak}
              </Box>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={6} md={3}>
          <StatCard
            label="Completed"
            value={completedTasks.length}
            icon={<TaskAltRounded />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            label="Pending"
            value={pendingTasks.length}
            icon={<PendingActionsRounded />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Points" value={points} icon={<StarRounded />} color="secondary.main" />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard label="Focus (7 days)" value={`${totalFocusHours}h`} icon={<TimerOutlined />} />
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Daily focus time
            </Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={concentrationChartData} margin={{ top: 8, right: 8, left: -12 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.palette.divider}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={chartAxis}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `${v}m`}
                    tick={chartAxis}
                    tickLine={false}
                    axisLine={false}
                  />
                  <RechartsTooltip
                    formatter={(value) => [`${value} min`, 'Focus time']}
                    contentStyle={chartTooltip}
                  />
                  <Line
                    type="monotone"
                    dataKey="minutes"
                    stroke={theme.palette.primary.main}
                    strokeWidth={3}
                    dot={{ r: 4, fill: theme.palette.primary.main, strokeWidth: 0 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Tasks completed
            </Typography>
            <Box sx={{ height: 280 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskChartData} margin={{ top: 8, right: 8, left: -24 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.palette.divider}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="date"
                    tickFormatter={shortDate}
                    tick={chartAxis}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis allowDecimals={false} tick={chartAxis} tickLine={false} axisLine={false} />
                  <RechartsTooltip
                    cursor={{ fill: theme.palette.action.hover }}
                    formatter={(value) => [`${value} tasks`, 'Completed']}
                    contentStyle={chartTooltip}
                  />
                  <Bar dataKey="count" fill={theme.palette.secondary.main} radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Recent sessions
            </Typography>
            {recentSessions.length === 0 ? (
              <Typography color="text.secondary">
                No sessions yet. Start a Pomodoro to see your history here.
              </Typography>
            ) : (
              <List disablePadding>
                {recentSessions.map((session) => (
                  <ListItem key={session.id} divider sx={{ px: 0 }}>
                    <ListItemText
                      primary={
                        session.startTime
                          ? new Date(session.startTime).toLocaleDateString()
                          : 'Unknown date'
                      }
                      secondary={`${session.duration ?? 0} min · ${session.type} session`}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Streak Tutorial Dialog */}
      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="md" fullWidth>
        <DialogTitle>Understanding the Streak System</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {tutorialSteps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Typography>{step.description}</Typography>
                  <Box sx={{ mb: 2, mt: 2 }}>
                    <div>
                      <Button
                        variant="contained"
                        onClick={
                          index === tutorialSteps.length - 1
                            ? () => {
                                setShowHelp(false);
                                handleReset();
                              }
                            : handleNext
                        }
                        sx={{ mt: 1, mr: 1 }}
                      >
                        {index === tutorialSteps.length - 1 ? 'Finish' : 'Continue'}
                      </Button>
                      <Button disabled={index === 0} onClick={handleBack} sx={{ mt: 1, mr: 1 }}>
                        Back
                      </Button>
                    </div>
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'space-between', px: 3, py: 2 }}>
          <Button
            onClick={() => {
              setShowHelp(false);
              handleReset();
            }}
            color="inherit"
          >
            Skip Tutorial
          </Button>
          <Button
            onClick={() => {
              setShowHelp(false);
              handleReset();
            }}
            variant="contained"
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard;
