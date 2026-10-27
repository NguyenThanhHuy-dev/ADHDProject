import React, { useState } from 'react';
import {
  Grid,
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
import HelpIcon from '@mui/icons-material/Help';
import useTaskStore from '../../store/taskStore';
import usePomodoroStore from '../../store/pomodoroStore';
import useRewardStore from '../../store/rewardStore';

function Dashboard() {
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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Dashboard</Typography>
        <Tooltip title="Help">
          <IconButton onClick={() => setShowHelp(true)}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={3}>
        {/* Streak Overview - Updated Dark Mode Colors */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 3,
              background:
                streakInfo.currentStreak >= 2
                  ? 'linear-gradient(135deg, #2a9d8f 0%, #1a6b61 100%)'
                  : 'linear-gradient(135deg, #2d3748 0%, #1a202c 100%)',
              color: 'white',
              position: 'relative',
              overflow: 'hidden',
              '&::before': {
                content: '""',
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background:
                  'radial-gradient(circle at 100% 0%, rgba(255,255,255,0.15) 0%, transparent 50%)',
              },
            }}
          >
            <Grid container alignItems="center" spacing={2}>
              <Grid item xs={12} md={6}>
                <Typography variant="h5" gutterBottom sx={{ color: 'rgba(255,255,255,0.9)' }}>
                  Concentration Streak
                </Typography>
                <Typography variant="h2" sx={{ fontWeight: 'bold', mb: 1, color: 'white' }}>
                  {streakInfo.currentStreak} {streakInfo.currentStreak === 1 ? 'Day' : 'Days'}
                </Typography>
                {streakInfo.currentStreak >= 2 ? (
                  <Typography variant="h6" sx={{ color: 'rgba(255,255,255,0.9)' }}>
                    Next Reward: {streakInfo.currentStreak * 10} Points
                  </Typography>
                ) : (
                  <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.8)' }}>
                    Complete 60 minutes of focused work today to start your streak!
                  </Typography>
                )}
              </Grid>
              <Grid item xs={12} md={6}>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    height: '100%',
                  }}
                >
                  <Box
                    sx={{
                      width: 120,
                      height: 120,
                      borderRadius: '50%',
                      border: '4px solid',
                      borderColor: streakInfo.currentStreak >= 2 ? '#4fd1c5' : '#4a5568',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: -4,
                        left: -4,
                        right: -4,
                        bottom: -4,
                        borderRadius: '50%',
                        border: '2px dashed',
                        borderColor:
                          streakInfo.currentStreak >= 2
                            ? 'rgba(79,209,197,0.4)'
                            : 'rgba(255,255,255,0.2)',
                        animation: 'spin 20s linear infinite',
                      },
                    }}
                  >
                    <Typography
                      variant="h3"
                      sx={{
                        fontWeight: 'bold',
                        color: streakInfo.currentStreak >= 2 ? '#4fd1c5' : 'white',
                      }}
                    >
                      {streakInfo.currentStreak}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Task Overview - Updated Dark Mode Colors */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'background.paper',
              '& .MuiTypography-root': {
                color: 'text.primary',
              },
            }}
          >
            <Typography variant="h6" gutterBottom>
              Task Overview
            </Typography>
            <Typography variant="body1">Completed Tasks: {completedTasks.length}</Typography>
            <Typography variant="body1">Pending Tasks: {pendingTasks.length}</Typography>
          </Paper>
        </Grid>

        {/* Points Overview - Updated Dark Mode Colors */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'background.paper',
              '& .MuiTypography-root': {
                color: 'text.primary',
              },
            }}
          >
            <Typography variant="h6" gutterBottom>
              Reward Points
            </Typography>
            <Typography variant="h4">{points}</Typography>
          </Paper>
        </Grid>

        {/* Recent Sessions - Updated Dark Mode Colors */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'background.paper',
              '& .MuiTypography-root': {
                color: 'text.primary',
              },
            }}
          >
            <Typography variant="h6" gutterBottom>
              Recent Sessions
            </Typography>
            <List>
              {recentSessions.map((session) => (
                <ListItem key={session.id}>
                  <ListItemText
                    primary={
                      session.startTime
                        ? new Date(session.startTime).toLocaleDateString()
                        : 'Unknown date'
                    }
                    secondary={`${session.type} session`}
                    primaryTypographyProps={{ color: 'text.primary' }}
                    secondaryTypographyProps={{ color: 'text.secondary' }}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        {/* Completed Tasks Chart - Updated Dark Mode Colors */}
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'background.paper',
              '& .MuiTypography-root': {
                color: 'text.primary',
              },
            }}
          >
            <Typography variant="h6" gutterBottom>
              Completed Tasks (Last 7 Days)
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={taskChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                    angle={-45}
                    textAnchor="end"
                    stroke="rgba(255,255,255,0.7)"
                  />
                  <YAxis tick={{ fill: 'rgba(255,255,255,0.7)' }} stroke="rgba(255,255,255,0.7)" />
                  <RechartsTooltip
                    formatter={(value) => [`${value} tasks`, 'Completed']}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(45, 55, 72, 0.95)',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                    }}
                  />
                  <Bar dataKey="count" fill="#4fd1c5" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Concentration Time Chart - Updated Dark Mode Colors */}
        <Grid item xs={12}>
          <Paper
            sx={{
              p: 2,
              bgcolor: 'background.paper',
              '& .MuiTypography-root': {
                color: 'text.primary',
              },
            }}
          >
            <Typography variant="h6" gutterBottom>
              Daily Concentration Time (Last 7 Days)
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={concentrationChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                    angle={-45}
                    textAnchor="end"
                    stroke="rgba(255,255,255,0.7)"
                  />
                  <YAxis
                    tickFormatter={(value) => `${value}h`}
                    tick={{ fill: 'rgba(255,255,255,0.7)' }}
                    stroke="rgba(255,255,255,0.7)"
                  />
                  <RechartsTooltip
                    formatter={(value) => [`${value} hours`, 'Concentration Time']}
                    labelFormatter={(label) => `Date: ${label}`}
                    contentStyle={{
                      backgroundColor: 'rgba(45, 55, 72, 0.95)',
                      border: 'none',
                      borderRadius: '4px',
                      color: 'white',
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="hours"
                    stroke="#4fd1c5"
                    strokeWidth={2}
                    dot={{ fill: '#4fd1c5', strokeWidth: 2 }}
                    activeDot={{ r: 8, fill: '#4fd1c5' }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </Box>
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
