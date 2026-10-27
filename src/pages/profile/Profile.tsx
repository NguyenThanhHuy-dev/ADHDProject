import { Box, Typography, Grid, useTheme } from '@mui/material';
import {
  AssignmentRounded,
  TaskAltRounded,
  TimerOutlined,
  HourglassBottomRounded,
  StarRounded,
} from '@mui/icons-material';
import StatCard from '../../components/StatCard';
import DonutCard from '../../components/DonutCard';
import useTaskStore from '../../store/taskStore';
import usePomodoroStore from '../../store/pomodoroStore';
import useRewardStore from '../../store/rewardStore';

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

  const theme = useTheme();
  const taskColors = [theme.palette.success.main, theme.palette.warning.main];
  const rarityColors = ['#94a3b8', '#3b82f6', '#a855f7', '#f59e0b'];

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Profile</Typography>
        <Typography variant="body2" color="text.secondary">
          Your lifetime stats
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={6} md={4}>
          <StatCard label="Total tasks" value={tasks.length} icon={<AssignmentRounded />} />
        </Grid>
        <Grid item xs={6} md={4}>
          <StatCard
            label="Completion rate"
            value={`${taskCompletionRate.toFixed(0)}%`}
            icon={<TaskAltRounded />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={6} md={4}>
          <StatCard
            label="Pomodoro sessions"
            value={totalSessions}
            icon={<TimerOutlined />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={6} md={6}>
          <StatCard
            label="Total focus time"
            value={`${Math.round(totalSessionTime)} min`}
            icon={<HourglassBottomRounded />}
          />
        </Grid>
        <Grid item xs={6} md={6}>
          <StatCard
            label="Reward points"
            value={points}
            icon={<StarRounded />}
            color="secondary.main"
          />
        </Grid>

        <Grid item xs={12} md={6}>
          <DonutCard
            title="Task distribution"
            data={taskChartData}
            colors={taskColors}
            emptyText="No tasks yet."
          />
        </Grid>
        <Grid item xs={12} md={6}>
          <DonutCard
            title="Reward distribution"
            data={rewardChartData}
            colors={rarityColors}
            emptyText="No rewards yet. Try your luck on the Rewards page."
          />
        </Grid>
      </Grid>
    </Box>
  );
}

export default Profile;
