import React, { useState } from 'react';
import {
  Box,
  LinearProgress,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  IconButton,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import { useCatalog, useGacha, useInventory, usePoints } from '../../api/hooks';
import useSoundStore from '../../store/soundStore';
import type { Rarity, Reward } from '../../types';
import { Help as HelpIcon } from '@mui/icons-material';

const rarityColors: Record<Rarity, string> = {
  common: '#95a5a6',
  rare: '#3498db',
  epic: '#9b59b6',
  legendary: '#f1c40f',
};

function Rewards() {
  const [open, setOpen] = useState(false);
  const [currentReward, setCurrentReward] = useState<Reward | null>(null);
  const points = usePoints().data?.balance ?? 0;
  const { data: inventory = [] } = useInventory();
  const { data: catalog } = useCatalog();
  const rewards = catalog?.rewards ?? [];
  const cost = catalog?.cost ?? 30;
  const gacha = useGacha();
  const playSound = useSoundStore((state) => state.playSound);
  const [showHelp, setShowHelp] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const tutorialSteps = [
    {
      label: 'Understanding Points',
      description:
        'You earn points by completing tasks in the Task List. Different tasks give different points based on their importance and urgency. Q1 tasks give 15 points, Q2 tasks give 10 points, Q3 tasks give 5 points, and Q4 tasks give 1 point.',
    },
    {
      label: 'The Gacha System',
      description:
        'Use your points to try your luck with the Gacha system! Each try costs 30 points. Click the "Try Your Luck!" button to get a random reward. The rewards have different rarities: Common (60%), Rare (30%), Epic (8%), and Legendary (2%).',
    },
    {
      label: 'Reward Rarities',
      description:
        'Common rewards are basic items, Rare rewards are special items, Epic rewards are amazing items, and Legendary rewards are the most incredible items. Each rarity has its own color: gray for Common, blue for Rare, purple for Epic, and gold for Legendary.',
    },
    {
      label: 'Your Inventory',
      description:
        'All rewards you receive are stored in your inventory. You can view your collection of rewards in the "Your Inventory" section. Each reward shows its name, rarity, and description.',
    },
    {
      label: 'Available Rewards',
      description:
        'The "Available Rewards" section shows all possible rewards you can get from the Gacha system. This helps you see what you might get and what you\'re still missing from your collection.',
    },
  ];

  // The server rolls the reward and charges the points; the client only shows the result.
  const handleGacha = () => {
    gacha.mutate(undefined, {
      onSuccess: ({ reward }) => {
        setCurrentReward(reward);
        setOpen(true);
        playSound('reward');
      },
      onError: () => playSound('notification'),
    });
  };

  const handleCloseDialog = () => {
    setOpen(false);
    playSound('notification');
  };

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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Box>
          <Typography variant="h4">Rewards</Typography>
          <Typography variant="body2" color="text.secondary">
            Spend the points you earn on random rewards
          </Typography>
        </Box>
        <Tooltip title="Help">
          <IconButton onClick={() => setShowHelp(true)} aria-label="Help">
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Paper
        sx={{
          p: { xs: 3, md: 4 },
          mb: 3,
          border: 'none',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 3,
          flexWrap: 'wrap',
          background: 'linear-gradient(135deg, #f59e0b 0%, #ef4444 60%, #ec4899 120%)',
        }}
      >
        <Box sx={{ flex: '1 1 260px' }}>
          <Typography variant="overline" sx={{ opacity: 0.9, letterSpacing: '0.08em' }}>
            Your balance
          </Typography>
          <Typography variant="h3" sx={{ fontWeight: 800, letterSpacing: '-0.03em' }}>
            {points} points
          </Typography>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, (points / cost) * 100)}
            aria-label="Progress to next try"
            sx={{
              mt: 1.5,
              height: 8,
              borderRadius: 4,
              bgcolor: 'rgba(255,255,255,0.3)',
              '& .MuiLinearProgress-bar': { bgcolor: '#fff', borderRadius: 4 },
            }}
          />
          <Typography variant="body2" sx={{ mt: 1, opacity: 0.9 }}>
            {points >= cost
              ? 'You can try your luck now.'
              : `${cost - points} more points for your next try.`}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          onClick={handleGacha}
          disabled={points < cost || gacha.isPending}
          sx={{
            bgcolor: '#fff',
            color: '#c2410c',
            px: 4,
            '&:hover': { bgcolor: '#fff7ed' },
            '&.Mui-disabled': { bgcolor: 'rgba(255,255,255,0.35)', color: 'rgba(255,255,255,0.8)' },
          }}
        >
          Try your luck ({cost} points)
        </Button>
      </Paper>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Your Inventory
            </Typography>
            <List>
              {inventory.map((item) => (
                <ListItem key={item.inventoryId}>
                  <ListItemAvatar>
                    <Avatar
                      sx={{
                        bgcolor: rarityColors[item.rarity],
                        width: 40,
                        height: 40,
                      }}
                    >
                      {item.image}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={item.name}
                    secondary={
                      <>
                        <Typography
                          component="span"
                          variant="body2"
                          color={rarityColors[item.rarity]}
                        >
                          {item.rarity.charAt(0).toUpperCase() + item.rarity.slice(1)}
                        </Typography>
                        <br />
                        {item.description}
                      </>
                    }
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Available Rewards
            </Typography>
            <Grid container spacing={2}>
              {rewards.map((reward) => (
                <Grid item xs={6} key={reward.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h1" component="div" sx={{ textAlign: 'center', mb: 2 }}>
                        {reward.image}
                      </Typography>
                      <Typography variant="h6" component="div">
                        {reward.name}
                      </Typography>
                      <Typography variant="body2" color={rarityColors[reward.rarity]}>
                        {reward.rarity.charAt(0).toUpperCase() + reward.rarity.slice(1)}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {reward.description}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={open} onClose={handleCloseDialog}>
        <DialogTitle>Congratulations!</DialogTitle>
        <DialogContent>
          <Box sx={{ textAlign: 'center', py: 2 }}>
            <Typography variant="h1" component="div" sx={{ mb: 2 }}>
              {currentReward?.image}
            </Typography>
            <Typography variant="h5" gutterBottom>
              {currentReward?.name}
            </Typography>
            <Typography
              variant="subtitle1"
              color={rarityColors[currentReward?.rarity ?? 'common']}
              gutterBottom
            >
              {currentReward?.rarity
                ? currentReward.rarity.charAt(0).toUpperCase() + currentReward.rarity.slice(1)
                : 'Unknown'}
            </Typography>
            <Typography variant="body1">{currentReward?.description}</Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="md" fullWidth>
        <DialogTitle>How to Use the Rewards System</DialogTitle>
        <DialogContent>
          <Stepper activeStep={activeStep} orientation="vertical">
            {tutorialSteps.map((step, index) => (
              <Step key={step.label}>
                <StepLabel>{step.label}</StepLabel>
                <StepContent>
                  <Typography>
                    {step.label === 'The Gacha System'
                      ? 'Use your points to try your luck with the Gacha system! Each try costs 30 points. Click the "Try Your Luck!" button to get a random reward. The rewards have different rarities: Common (60%), Rare (30%), Epic (8%), and Legendary (2%).'
                      : step.description}
                  </Typography>
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

export default Rewards;
