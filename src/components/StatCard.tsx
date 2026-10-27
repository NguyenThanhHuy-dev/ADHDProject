import type { ReactNode } from 'react';
import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface StatCardProps {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  color?: string;
}

const StatCard = ({ label, value, hint, icon, color = 'primary.main' }: StatCardProps) => (
  <Paper
    sx={{
      p: { xs: 1.75, sm: 2.5 },
      height: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: { xs: 1.5, sm: 2 },
    }}
  >
    <Box
      sx={(theme) => ({
        width: { xs: 40, sm: 48 },
        height: { xs: 40, sm: 48 },
        flexShrink: 0,
        borderRadius: 3,
        display: 'grid',
        placeItems: 'center',
        color,
        bgcolor: alpha(theme.palette.primary.main, 0.1),
      })}
    >
      {icon}
    </Box>
    <Box sx={{ minWidth: 0 }}>
      <Typography variant="body2" color="text.secondary" noWrap>
        {label}
      </Typography>
      <Typography variant="h5" sx={{ lineHeight: 1.2 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  </Paper>
);

export default StatCard;
