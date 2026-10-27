import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Button,
  Paper,
  Grid,
  IconButton,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Stepper,
  Step,
  StepLabel,
  StepContent,
} from '@mui/material';
import {
  PlayArrow as PlayIcon,
  Pause as PauseIcon,
  Refresh as RefreshIcon,
  Settings as SettingsIcon,
  Restore as RestoreIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import usePomodoroStore from '../../store/pomodoroStore';
import useRewardStore from '../../store/rewardStore';
import useSoundStore from '../../store/soundStore';
import useTaskStore from '../../store/taskStore';

const POMODORO_DURATIONS = [15, 25, 45, 60, 90, 120];
const BREAK_DURATIONS = [5, 10, 15];
const DEFAULT_WORK_TIME = 25;
const DEFAULT_BREAK_TIME = 5;
const GRAY_TASK_DURATION = 15;

// Updated color scheme progressing from cool to warm as duration increases
const DURATION_COLORS: Record<number, string> = {
  15: '#4cc9f0', // Cool blue for short sessions
  25: '#4361ee', // Medium blue for standard sessions
  45: '#3a0ca3', // Deep blue for extended sessions
  60: '#7209b7', // Purple for long sessions
  90: '#f72585', // Hot pink for very long sessions
  120: '#ff9e00', // Warm orange for ultra-long sessions
};

const QUADRANT_POINTS: Record<string, number> = {
  q1: 15, // Urgent & Important
  q2: 10, // Important, Not Urgent
  q3: 5, // Urgent, Not Important
  q4: 1, // Not Urgent, Not Important
};

function Pomodoro() {
  const [isRunning, setIsRunning] = useState(false);
  const [timeLeft, setTimeLeft] = useState(DEFAULT_WORK_TIME * 60);
  const [isWorkMode, setIsWorkMode] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [workTime, setWorkTime] = useState(DEFAULT_WORK_TIME);
  const [breakTime, setBreakTime] = useState(DEFAULT_BREAK_TIME);
  const [totalTime, setTotalTime] = useState(DEFAULT_WORK_TIME * 60);
  const [selectedTask, setSelectedTask] = useState<number | ''>('');
  const timerRef = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const progressRef = useRef<SVGCircleElement>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [backgroundColor, setBackgroundColor] = useState(DURATION_COLORS[DEFAULT_WORK_TIME]);

  const tasks = useTaskStore((state) => state.tasks);
  const pendingTasks = tasks.filter((task) => !task.completed);
  const addSession = usePomodoroStore((state) => state.addSession);
  const addPoints = useRewardStore((state) => state.addPoints);
  const playSound = useSoundStore((state) => state.playSound);

  const tutorialSteps = [
    {
      label: 'Select a Task',
      description:
        'Choose a task from the dropdown menu. Gray tasks (not urgent, not important) will automatically set to 15 minutes, while other tasks will default to 25 minutes.',
    },
    {
      label: 'Adjust Timer (Optional)',
      description:
        'You can customize the work duration using the settings menu. Click the settings icon to open it. Different durations are recommended for different types of tasks.',
    },
    {
      label: 'Start the Timer',
      description:
        'Click the Start button to begin your work session. The circular progress indicator will show your remaining time.',
    },
    {
      label: 'Take Breaks',
      description:
        "After completing a work session, you'll automatically enter a break period. Use this time to rest and recharge.",
    },
    {
      label: 'Earn Points',
      description:
        'Complete tasks to earn points based on their importance and urgency. These points can be used to unlock rewards in the Rewards page.',
    },
  ];

  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            // eslint-disable-next-line react-hooks/immutability
            handleTimerComplete();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shortcut: re-subscribes only on run/stop; upgrade with a ref to the latest callback
  }, [isRunning]);

  useEffect(() => {
    if (progressRef.current && totalTime > 0) {
      const progress = ((totalTime - timeLeft) / totalTime) * 283;
      progressRef.current.style.strokeDashoffset = String(283 - progress);
    }
  }, [timeLeft, totalTime]);

  const handleTaskSelect = (taskId: number | '') => {
    setSelectedTask(taskId);
    const task = tasks.find((t) => t.id === taskId);
    if (task && !isRunning) {
      const defaultDuration = task.quadrant === 'q4' ? GRAY_TASK_DURATION : DEFAULT_WORK_TIME;
      setWorkTime(defaultDuration);
      setBackgroundColor(DURATION_COLORS[defaultDuration]);
      setTimeLeft(defaultDuration * 60);
      setTotalTime(defaultDuration * 60);
      if (progressRef.current) {
        progressRef.current.style.strokeDashoffset = '0';
      }
    }
  };

  const handleWorkTimeChange = (newDuration: number) => {
    setWorkTime(newDuration);
    setBackgroundColor(DURATION_COLORS[newDuration]);
    if (!isRunning) {
      setTimeLeft(newDuration * 60);
      setTotalTime(newDuration * 60);
      if (progressRef.current) {
        progressRef.current.style.strokeDashoffset = '0';
      }
    }
  };

  const handleStartPause = () => {
    if (!isRunning && isWorkMode && !selectedTask) {
      return; // Don't start if no task is selected in work mode
    }
    if (!isRunning) {
      playSound('start');
    } else {
      playSound('notification');
    }
    setIsRunning(!isRunning);
  };

  const handleReset = () => {
    playSound('notification');
    setIsRunning(false);
    setTimeLeft(isWorkMode ? workTime * 60 : breakTime * 60);
    setTotalTime(isWorkMode ? workTime * 60 : breakTime * 60);
    if (progressRef.current) {
      progressRef.current.style.strokeDashoffset = '0';
    }
    setActiveStep(0);
  };

  const handleTimerComplete = () => {
    setIsRunning(false);
    if (isWorkMode) {
      const now = new Date();
      const start = now.getTime() - workTime * 60 * 1000;
      addSession({
        id: Date.now(),
        taskId: selectedTask,
        startTime: new Date(start).toISOString(),
        endTime: now.toISOString(),
        duration: Number(workTime) || 0,
        type: 'work',
        completed: true,
      });
      addPoints(10);
      playSound('complete');
      setTimeLeft(breakTime * 60);
      setTotalTime(breakTime * 60);
      setIsWorkMode(false);
    } else {
      playSound('notification');
      setTimeLeft(workTime * 60);
      setTotalTime(workTime * 60);
      setIsWorkMode(true);
    }
  };

  const handleSettingsSave = () => {
    setTimeLeft(workTime * 60);
    setTotalTime(workTime * 60);
    setShowSettings(false);
    setIsRunning(false);
    if (progressRef.current) {
      progressRef.current.style.strokeDashoffset = '0';
    }
  };

  const handleResetToDefault = () => {
    setWorkTime(DEFAULT_WORK_TIME);
    setBreakTime(DEFAULT_BREAK_TIME);
    setBackgroundColor(DURATION_COLORS[DEFAULT_WORK_TIME]);
    setTimeLeft(DEFAULT_WORK_TIME * 60);
    setTotalTime(DEFAULT_WORK_TIME * 60);
    setIsRunning(false);
    if (progressRef.current) {
      progressRef.current.style.strokeDashoffset = '0';
    }
    playSound('notification');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getTaskPoints = (task: { quadrant: string }) => {
    return QUADRANT_POINTS[task.quadrant] || 0;
  };

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4">Pomodoro Timer</Typography>
        <Box>
          <Tooltip title="Help">
            <IconButton onClick={() => setShowHelp(true)} sx={{ mr: 1 }}>
              <HelpIcon />
            </IconButton>
          </Tooltip>
          <Tooltip title="Settings">
            <IconButton onClick={() => setShowSettings(!showSettings)}>
              <SettingsIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper
            sx={{
              p: 3,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              transition: 'all 0.5s ease',
              background: `linear-gradient(135deg, ${backgroundColor}20 0%, ${backgroundColor}08 100%)`,
              boxShadow: `0 4px 20px ${backgroundColor}30`,
              '&:hover': {
                boxShadow: `0 6px 25px ${backgroundColor}40`,
              },
            }}
          >
            <Box sx={{ position: 'relative', width: 300, height: 300 }}>
              <svg
                viewBox="0 0 100 100"
                style={{
                  width: '100%',
                  height: '100%',
                  transform: 'rotate(-90deg)',
                }}
              >
                <circle cx="50" cy="50" r="45" fill="none" stroke="#e0e0e0" strokeWidth="4" />
                <circle
                  ref={progressRef}
                  cx="50"
                  cy="50"
                  r="45"
                  fill="none"
                  stroke={backgroundColor}
                  strokeWidth="4"
                  strokeDasharray="283"
                  strokeDashoffset="0"
                  style={{
                    transition: 'stroke-dashoffset 1s linear, stroke 0.5s ease',
                    filter: 'drop-shadow(0 0 8px rgba(0,0,0,0.1))',
                  }}
                />
              </svg>
              <Box
                sx={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  textAlign: 'center',
                }}
              >
                <Typography
                  variant="h2"
                  component="div"
                  sx={{
                    color: backgroundColor,
                    textShadow: `0 2px 4px ${backgroundColor}30`,
                    fontWeight: 'bold',
                  }}
                >
                  {formatTime(timeLeft)}
                </Typography>
                <Typography
                  variant="h6"
                  sx={{
                    color: 'text.secondary',
                    mt: 1,
                  }}
                >
                  {isWorkMode ? 'Work Session' : 'Break Time'}
                </Typography>
              </Box>
            </Box>

            {isWorkMode && (
              <FormControl sx={{ mt: 2, minWidth: 200 }}>
                <InputLabel>Select Task</InputLabel>
                <Select
                  value={selectedTask}
                  label="Select Task"
                  onChange={(e) => handleTaskSelect(e.target.value as number | '')}
                  disabled={isRunning}
                >
                  {pendingTasks.map((task) => (
                    <MenuItem key={task.id} value={task.id}>
                      <Tooltip
                        title={
                          task.quadrant === 'q4'
                            ? 'Gray tasks automatically set to 15 minutes'
                            : 'Other tasks automatically set to 25 minutes'
                        }
                        placement="right"
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            width: '100%',
                          }}
                        >
                          <Typography>{task.title}</Typography>
                          <Typography
                            sx={{
                              ml: 1,
                              color: 'text.secondary',
                              fontSize: '0.875rem',
                            }}
                          >
                            +{getTaskPoints(task)} pts
                          </Typography>
                        </Box>
                      </Tooltip>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            )}

            <Box sx={{ mt: 3, display: 'flex', gap: 2 }}>
              <Button
                variant="contained"
                color={isWorkMode ? 'primary' : 'secondary'}
                onClick={handleStartPause}
                startIcon={isRunning ? <PauseIcon /> : <PlayIcon />}
                disabled={isWorkMode && !selectedTask}
              >
                {isRunning ? 'Pause' : 'Start'}
              </Button>
              <Button variant="outlined" onClick={handleReset} startIcon={<RefreshIcon />}>
                Reset
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Statistics
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Sessions Completed
                </Typography>
                <Typography variant="h4">{usePomodoroStore.getState().sessions.length}</Typography>
              </Grid>
              <Grid item xs={6}>
                <Typography variant="subtitle2" color="text.secondary">
                  Total Focus Time
                </Typography>
                <Typography variant="h4">
                  {usePomodoroStore.getState().sessions.reduce((acc, session) => {
                    const d = Number(session.duration);
                    return acc + (isNaN(d) ? 0 : d);
                  }, 0)}
                  m
                </Typography>
              </Grid>
            </Grid>
          </Paper>

          {showSettings && (
            <Paper sx={{ p: 3, mt: 3 }}>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2,
                }}
              >
                <Typography variant="h6">Timer Settings</Typography>
                <Tooltip title="Reset to default settings (25 min work, 5 min break)">
                  <Button
                    variant="outlined"
                    startIcon={<RestoreIcon />}
                    onClick={handleResetToDefault}
                    size="small"
                  >
                    Reset to Default
                  </Button>
                </Tooltip>
              </Box>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Work Duration</InputLabel>
                    <Select
                      value={workTime}
                      label="Work Duration"
                      onChange={(e) => handleWorkTimeChange(Number(e.target.value))}
                    >
                      {POMODORO_DURATIONS.map((duration) => (
                        <MenuItem key={duration} value={duration}>
                          <Tooltip
                            title={
                              duration === 25
                                ? 'Classic Pomodoro duration - recommended for most tasks'
                                : duration === 15
                                  ? "Short sessions - good for quick tasks or when you're feeling distracted"
                                  : duration === 45
                                    ? 'Extended sessions - good for deep work'
                                    : duration === 60
                                      ? 'Long sessions - ideal for complex tasks'
                                      : duration === 90
                                        ? 'Very long sessions - best for intense focus work'
                                        : 'Ultra-long sessions - use sparingly for marathon work sessions'
                            }
                            placement="right"
                          >
                            <Box sx={{ width: '100%' }}>
                              {duration} minutes
                              {selectedTask &&
                                tasks.find((t) => t.id === selectedTask)?.quadrant === 'q4' &&
                                duration === 15 && (
                                  <Typography
                                    component="span"
                                    sx={{
                                      ml: 1,
                                      color: 'text.secondary',
                                      fontSize: '0.75rem',
                                    }}
                                  >
                                    (Default for gray tasks)
                                  </Typography>
                                )}
                            </Box>
                          </Tooltip>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth>
                    <InputLabel>Break Duration</InputLabel>
                    <Select
                      value={breakTime}
                      label="Break Duration"
                      onChange={(e) => setBreakTime(Number(e.target.value))}
                    >
                      {BREAK_DURATIONS.map((duration) => (
                        <MenuItem key={duration} value={duration}>
                          <Tooltip
                            title={
                              duration === 5
                                ? 'Standard break - recommended for most work sessions'
                                : duration === 10
                                  ? 'Extended break - good after longer work sessions'
                                  : 'Long break - ideal after intense focus periods'
                            }
                            placement="right"
                          >
                            <Box sx={{ width: '100%' }}>{duration} minutes</Box>
                          </Tooltip>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'flex-end' }}>
                <Button variant="contained" onClick={handleSettingsSave}>
                  Save Settings
                </Button>
              </Box>
            </Paper>
          )}
        </Grid>
      </Grid>

      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="md" fullWidth>
        <DialogTitle>How to Use the Pomodoro Timer</DialogTitle>
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

export default Pomodoro;
