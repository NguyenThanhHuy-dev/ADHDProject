import React from 'react';
import { Box, Typography, Grid, Paper, List, ListItem, ListItemText, Divider } from '@mui/material';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import useTaskStore from '../../store/taskStore';
import usePomodoroStore from '../../store/pomodoroStore';
import useRewardStore from '../../store/rewardStore';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'];

function Profile() {
  const tasks = useTaskStore((state) => state.tasks);
  const sessions = usePomodoroStore((state) => state.sessions);
  const points = useRewardStore((state) => state.points);
  const rarityDistribution = useRewardStore((state) => state.getRarityDistribution());

  // Calculate task completion statistics
  const completedTasks = tasks.filter((task) => task.completed);
  const taskCompletionRate = tasks.length ? (completedTasks.length / tasks.length) * 100 : 0;

  // Calculate session statistics
  const totalSessions = sessions.length;
  const totalSessionTime = sessions.reduce((acc, session) => {
    if (!session.startTime || !session.endTime) return acc;

    const start = new Date(session.startTime);
    const end = new Date(session.endTime);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return acc;

    return acc + (end.getTime() - start.getTime()) / 1000 / 60;
  }, 0);

  // Prepare chart data
  const taskChartData = [
    { name: 'Completed', value: completedTasks.length },
    { name: 'Pending', value: tasks.length - completedTasks.length },
  ];

  const rewardChartData = [
    { name: 'Common', value: rarityDistribution.common },
    { name: 'Rare', value: rarityDistribution.rare },
    { name: 'Epic', value: rarityDistribution.epic },
    { name: 'Legendary', value: rarityDistribution.legendary },
  ];

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Profile
      </Typography>

      <Grid container spacing={3}>
        {/* Statistics Overview */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Statistics Overview
            </Typography>
            <List>
              <ListItem>
                <ListItemText primary="Total Tasks" secondary={`${tasks.length} tasks`} />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Task Completion Rate"
                  secondary={`${taskCompletionRate.toFixed(1)}%`}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Total Pomodoro Sessions"
                  secondary={`${totalSessions} sessions`}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Total Focus Time"
                  secondary={`${Math.round(totalSessionTime)} minutes`}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText primary="Reward Points" secondary={`${points} points`} />
              </ListItem>
            </List>
          </Paper>
        </Grid>

        {/* Task Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Task Distribution
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={taskChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {taskChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        {/* Reward Distribution */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Reward Distribution
            </Typography>
            <Box sx={{ height: 300 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={rewardChartData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {rewardChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Profile;
