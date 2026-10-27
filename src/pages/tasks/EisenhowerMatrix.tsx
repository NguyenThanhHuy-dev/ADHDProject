import React from 'react';
import { Box, Typography, Paper, Grid } from '@mui/material';

const EisenhowerMatrix = () => {
  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        Eisenhower Matrix
      </Typography>
      <Grid container spacing={2}>
        <Grid item xs={6}>
          <Paper sx={{ p: 2, height: '200px', bgcolor: '#ffebee' }}>
            <Typography variant="h6">Urgent & Important</Typography>
            {/* Add your urgent & important tasks here */}
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper sx={{ p: 2, height: '200px', bgcolor: '#e8f5e9' }}>
            <Typography variant="h6">Important, Not Urgent</Typography>
            {/* Add your important, not urgent tasks here */}
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper sx={{ p: 2, height: '200px', bgcolor: '#e3f2fd' }}>
            <Typography variant="h6">Urgent, Not Important</Typography>
            {/* Add your urgent, not important tasks here */}
          </Paper>
        </Grid>
        <Grid item xs={6}>
          <Paper sx={{ p: 2, height: '200px', bgcolor: '#f5f5f5' }}>
            <Typography variant="h6">Not Urgent & Not Important</Typography>
            {/* Add your not urgent & not important tasks here */}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default EisenhowerMatrix;
