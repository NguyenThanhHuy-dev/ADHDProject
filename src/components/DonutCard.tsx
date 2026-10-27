import { Box, Paper, Typography, useTheme } from '@mui/material';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const DonutCard = ({
  title,
  data,
  colors,
  emptyText,
}: {
  title: string;
  data: { name: string; value: number }[];
  colors: string[];
  emptyText: string;
}) => {
  const theme = useTheme();
  const total = data.reduce((sum, d) => sum + d.value, 0);
  return (
    <Paper sx={{ p: 3, height: '100%' }}>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {total === 0 ? (
        <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
          {emptyText}
        </Typography>
      ) : (
        <>
          <Box sx={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  innerRadius={62}
                  outerRadius={90}
                  paddingAngle={3}
                  stroke="none"
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={colors[index % colors.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.palette.background.paper,
                    border: `1px solid ${theme.palette.divider}`,
                    borderRadius: 10,
                    color: theme.palette.text.primary,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Box>
          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2.5, flexWrap: 'wrap' }}>
            {data.map((entry, index) => (
              <Box key={entry.name} sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <Box
                  sx={{
                    width: 10,
                    height: 10,
                    borderRadius: '50%',
                    bgcolor: colors[index % colors.length],
                  }}
                />
                <Typography variant="body2" color="text.secondary">
                  {entry.name} · {entry.value}
                </Typography>
              </Box>
            ))}
          </Box>
        </>
      )}
    </Paper>
  );
};

export default DonutCard;
