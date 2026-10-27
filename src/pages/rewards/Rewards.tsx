import React, { useState } from 'react';
import {
  Box,
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
import useRewardStore from '../../store/rewardStore';
import useSoundStore from '../../store/soundStore';
import type { Rarity, Reward } from '../../types';
import HelpIcon from '@mui/icons-material/Help';

const rarityColors: Record<Rarity, string> = {
  common: '#95a5a6',
  rare: '#3498db',
  epic: '#9b59b6',
  legendary: '#f1c40f',
};

const rarityProbabilities: Record<Rarity, number> = {
  common: 0.6,
  rare: 0.3,
  epic: 0.08,
  legendary: 0.02,
};

const rewards: Reward[] = [
  {
    id: 1,
    name: 'Common Reward 1',
    description: 'A basic reward',
    rarity: 'common',
    image: '🎁',
  },
  {
    id: 2,
    name: 'Common Reward 2',
    description: 'Another basic reward',
    rarity: 'common',
    image: '🎯',
  },
  {
    id: 3,
    name: 'Rare Reward 1',
    description: 'A special reward',
    rarity: 'rare',
    image: '🏆',
  },
  {
    id: 4,
    name: 'Rare Reward 2',
    description: 'Another special reward',
    rarity: 'rare',
    image: '🎨',
  },
  {
    id: 5,
    name: 'Epic Reward 1',
    description: 'An amazing reward',
    rarity: 'epic',
    image: '🌟',
  },
  {
    id: 6,
    name: 'Epic Reward 2',
    description: 'Another amazing reward',
    rarity: 'epic',
    image: '💫',
  },
  {
    id: 7,
    name: 'Legendary Reward 1',
    description: 'An incredible reward',
    rarity: 'legendary',
    image: '👑',
  },
  {
    id: 8,
    name: 'Legendary Reward 2',
    description: 'Another incredible reward',
    rarity: 'legendary',
    image: '🏰',
  },
];

function Rewards() {
  const [open, setOpen] = useState(false);
  const [currentReward, setCurrentReward] = useState<Reward | null>(null);
  const points = useRewardStore((state) => state.points);
  const inventory = useRewardStore((state) => state.inventory);
  const spendPoints = useRewardStore((state) => state.spendPoints);
  const addToInventory = useRewardStore((state) => state.addToInventory);
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

  const getRandomReward = () => {
    const random = Math.random();
    let cumulativeProbability = 0;
    let selectedRarity: Rarity | undefined;

    for (const [rarity, probability] of Object.entries(rarityProbabilities) as [Rarity, number][]) {
      cumulativeProbability += probability;
      if (random <= cumulativeProbability) {
        selectedRarity = rarity;
        break;
      }
    }

    const availableRewards = rewards.filter((reward) => reward.rarity === selectedRarity);
    if (availableRewards.length === 0) return null;
    return availableRewards[Math.floor(Math.random() * availableRewards.length)];
  };

  const handleGacha = () => {
    if (points >= 30) {
      const reward = getRandomReward();
      if (!reward) {
        playSound('notification');
        return;
      }
      setCurrentReward(reward);
      setOpen(true);
      spendPoints(30);
      addToInventory(reward);
      playSound('reward');
    } else {
      playSound('notification');
    }
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
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Rewards</Typography>
        <Tooltip title="Help">
          <IconButton onClick={() => setShowHelp(true)}>
            <HelpIcon />
          </IconButton>
        </Tooltip>
      </Box>

      <Box
        sx={{
          display: 'flex',
          justifyContent: 'center',
          mb: 4,
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: '50%',
            left: 0,
            right: 0,
            height: '1px',
            backgroundColor: 'divider',
            zIndex: 0,
          },
        }}
      >
        <Button
          variant="contained"
          onClick={handleGacha}
          disabled={points < 30}
          sx={{
            zIndex: 1,
            py: 1.5,
            px: 4,
            fontSize: '1.1rem',
            borderRadius: '50px',
            boxShadow: 3,
            background: 'linear-gradient(45deg, #FF6B6B 30%, #FF8E53 90%)',
            '&:hover': {
              boxShadow: 6,
              transform: 'translateY(-2px)',
              background: 'linear-gradient(45deg, #FF8E53 30%, #FF6B6B 90%)',
            },
            '&:disabled': {
              background: 'linear-gradient(45deg, #BDBDBD 30%, #9E9E9E 90%)',
              transform: 'none',
              boxShadow: 3,
            },
            transition: 'all 0.2s ease-in-out',
          }}
        >
          Try Your Luck! (30 points)
        </Button>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>
              Your Inventory
            </Typography>
            <List>
              {inventory.map((item, index) => (
                <ListItem key={index}>
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
