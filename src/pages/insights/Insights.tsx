import { Box, Grid, LinearProgress, Paper, Tooltip as MuiTooltip, Typography } from '@mui/material';
import {
  BarChart,
  Bar,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { alpha, useTheme } from '@mui/material/styles';
import {
  EmojiEventsRounded,
  LocalFireDepartmentRounded,
  TimerOutlined,
  TodayRounded,
} from '@mui/icons-material';
import { useHeatmap, useHours, useOverview, useWeekly } from '../../api/hooks';
import StatCard from '../../components/StatCard';
import useThemeStore from '../../store/themeStore';
import { intensityLevel, toWeekColumns } from './heatmap';

const QUADRANT_LABELS = {
  q1: 'Urgent & Important',
  q2: 'Important, Not Urgent',
  q3: 'Urgent, Not Important',
  q4: 'Not Urgent, Not Important',
} as const;

const formatHour = (h: number) => `${String(h).padStart(2, '0')}:00`;
const formatMinutes = (m: number) => (m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`);
const shortDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

function Insights() {
  const theme = useTheme();
  const animate = !useThemeStore((state) => state.reducedMotion);
  const { data: overview } = useOverview();
  const { data: heatmap } = useHeatmap(26);
  const { data: hours } = useHours();
  const { data: weekly } = useWeekly(8);

  const axis = { fontSize: 12, fill: theme.palette.text.secondary };
  const tooltipStyle = {
    backgroundColor: theme.palette.background.paper,
    border: `1px solid ${theme.palette.divider}`,
    borderRadius: 10,
    color: theme.palette.text.primary,
  };
  const levelColor = (level: number) =>
    level === 0
      ? alpha(theme.palette.text.primary, theme.palette.mode === 'dark' ? 0.08 : 0.06)
      : alpha(theme.palette.primary.main, [0, 0.25, 0.5, 0.75, 1][level]);

  const columns = toWeekColumns(heatmap?.days ?? []);
  const focus = overview?.focus;

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4">Insights</Typography>
        <Typography variant="body2" color="text.secondary">
          When you focus best, and how your habits are trending
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={6} md={3}>
          <StatCard
            label="Total focus"
            value={formatMinutes(focus?.totalMinutes ?? 0)}
            hint={`${focus?.totalSessions ?? 0} sessions`}
            icon={<TimerOutlined />}
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            label="Active days"
            value={focus?.activeDays ?? 0}
            hint={`${focus?.avgMinutesPerActiveDay ?? 0} min on average`}
            icon={<TodayRounded />}
            color="success.main"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            label="Longest streak"
            value={`${focus?.longestStreakDays ?? 0} days`}
            icon={<LocalFireDepartmentRounded />}
            color="warning.main"
          />
        </Grid>
        <Grid item xs={6} md={3}>
          <StatCard
            label="Best day"
            value={focus?.bestDay ? formatMinutes(focus.bestDay.minutes) : '-'}
            hint={focus?.bestDay ? shortDate(focus.bestDay.day) : 'No sessions yet'}
            icon={<EmojiEventsRounded />}
            color="secondary.main"
          />
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Focus calendar
            </Typography>
            <Box sx={{ overflowX: 'auto', pb: 1 }}>
              <Box
                role="img"
                aria-label="Focus minutes per day over the last 26 weeks"
                sx={{
                  display: 'grid',
                  gridAutoFlow: 'column',
                  gridTemplateRows: 'repeat(7, auto)',
                  gridTemplateColumns: `repeat(${columns.length}, minmax(14px, 1fr))`,
                  gap: '4px',
                  minWidth: columns.length * 18,
                }}
              >
                {columns.flatMap((column, ci) =>
                  column.map((cell, ri) =>
                    cell ? (
                      <MuiTooltip
                        key={cell.date}
                        title={`${shortDate(cell.date)}: ${cell.minutes} min, ${cell.sessions} session${cell.sessions === 1 ? '' : 's'}`}
                        arrow
                      >
                        <Box
                          data-level={intensityLevel(cell.minutes)}
                          sx={{
                            aspectRatio: '1',
                            borderRadius: '3px',
                            bgcolor: levelColor(intensityLevel(cell.minutes)),
                          }}
                        />
                      </MuiTooltip>
                    ) : (
                      <Box key={`pad-${ci}-${ri}`} sx={{ aspectRatio: '1' }} />
                    ),
                  ),
                )}
              </Box>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 1.5 }}>
              <Typography variant="caption" color="text.secondary">
                Less
              </Typography>
              {[0, 1, 2, 3, 4].map((l) => (
                <Box
                  key={l}
                  sx={{ width: 14, height: 14, borderRadius: '3px', bgcolor: levelColor(l) }}
                />
              ))}
              <Typography variant="caption" color="text.secondary">
                More
              </Typography>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6">Your best time of day</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {hours?.bestHour != null
                ? `You finish the most focus time around ${formatHour(hours.bestHour)}.`
                : 'Complete a few sessions to find your golden hour.'}
            </Typography>
            <Box sx={{ height: 240 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hours?.hours ?? []} margin={{ top: 8, right: 8, left: -20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.palette.divider}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="hour"
                    tickFormatter={(h: number) => String(h)}
                    tick={axis}
                    tickLine={false}
                    axisLine={false}
                    interval={2}
                  />
                  <YAxis tick={axis} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: theme.palette.action.hover }}
                    labelFormatter={(h) => formatHour(Number(h))}
                    formatter={(v) => [`${v} min`, 'Focus']}
                    contentStyle={tooltipStyle}
                  />
                  <Bar isAnimationActive={animate} dataKey="minutes" radius={[4, 4, 0, 0]}>
                    {(hours?.hours ?? []).map((h) => (
                      <Cell
                        key={h.hour}
                        fill={
                          h.hour === hours?.bestHour
                            ? theme.palette.secondary.main
                            : theme.palette.primary.main
                        }
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Tasks by priority
            </Typography>
            {overview?.tasks.byQuadrant.length ? (
              <Box sx={{ display: 'grid', gap: 2 }}>
                {overview.tasks.byQuadrant.map((q) => {
                  const total = q.done + q.open;
                  return (
                    <Box key={q.quadrant}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                        <Typography variant="body2">{QUADRANT_LABELS[q.quadrant]}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {q.done}/{total}
                        </Typography>
                      </Box>
                      <LinearProgress
                        variant="determinate"
                        value={total ? (q.done / total) * 100 : 0}
                        aria-label={`${QUADRANT_LABELS[q.quadrant]} completion`}
                        sx={{ height: 8, borderRadius: 4, mt: 0.5 }}
                      />
                    </Box>
                  );
                })}
                <Typography variant="body2" color="text.secondary">
                  Overall completion: {overview.tasks.completionRate}%
                </Typography>
              </Box>
            ) : (
              <Typography color="text.secondary">
                Add tasks to see how you spread your effort.
              </Typography>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Weekly trend
            </Typography>
            <Box sx={{ height: 260 }}>
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={weekly?.weeks ?? []} margin={{ top: 8, right: 8, left: -20 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke={theme.palette.divider}
                    vertical={false}
                  />
                  <XAxis
                    dataKey="weekStart"
                    tickFormatter={shortDate}
                    tick={axis}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis yAxisId="min" tick={axis} tickLine={false} axisLine={false} />
                  <YAxis
                    yAxisId="tasks"
                    orientation="right"
                    allowDecimals={false}
                    tick={axis}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    labelFormatter={(d) => `Week of ${shortDate(String(d))}`}
                    contentStyle={tooltipStyle}
                  />
                  <Bar
                    isAnimationActive={animate}
                    yAxisId="min"
                    dataKey="minutes"
                    name="Focus (min)"
                    fill={theme.palette.primary.main}
                    radius={[6, 6, 0, 0]}
                  />
                  <Line
                    isAnimationActive={animate}
                    yAxisId="tasks"
                    type="monotone"
                    dataKey="tasksCompleted"
                    name="Tasks done"
                    stroke={theme.palette.secondary.main}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Insights;
