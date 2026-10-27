import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Stack,
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Edit as EditIcon,
  Star as StarIcon,
  PriorityHigh as PriorityHighIcon,
  Add as AddIcon,
  Check as CheckIcon,
  Help as HelpIcon,
} from '@mui/icons-material';
import useTaskStore from '../../store/taskStore';
import useRewardStore from '../../store/rewardStore';
import useSoundStore from '../../store/soundStore';
import type { QuadrantId, Task } from '../../types';

const quadrants: { id: QuadrantId; title: string; color: string; points: number }[] = [
  { id: 'q1', title: 'Urgent & Important', color: '#ff6b6b', points: 15 },
  { id: 'q2', title: 'Important, Not Urgent', color: '#4ecdc4', points: 10 },
  { id: 'q3', title: 'Urgent, Not Important', color: '#ffd93d', points: 5 },
  { id: 'q4', title: 'Not Urgent, Not Important', color: '#95a5a6', points: 1 },
];

function TaskList() {
  const [open, setOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [taskForm, setTaskForm] = useState({
    title: '',
    description: '',
    isImportant: false,
    isUrgent: false,
    dueDate: '',
    dueTime: '23:59',
  });
  const [showHelp, setShowHelp] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const tasks = useTaskStore((state) => state.tasks);
  const addTask = useTaskStore((state) => state.addTask);
  const updateTask = useTaskStore((state) => state.updateTask);
  const deleteTask = useTaskStore((state) => state.deleteTask);
  const completeTask = useTaskStore((state) => state.completeTask);
  const addPoints = useRewardStore((state) => state.addPoints);
  const playSound = useSoundStore((state) => state.playSound);

  const tutorialSteps = [
    {
      label: 'Understanding the Matrix',
      description:
        'The Eisenhower Matrix helps you prioritize tasks based on their urgency and importance. Tasks are organized into four quadrants: Urgent & Important (Q1), Important but Not Urgent (Q2), Urgent but Not Important (Q3), and Neither Urgent nor Important (Q4).',
    },
    {
      label: 'Adding Tasks',
      description:
        'Click the "Add Task" button to create a new task. You can set the task title, description, and priority using the "Important" and "Urgent" toggles. The task will automatically be placed in the correct quadrant based on your selections.',
    },
    {
      label: 'Managing Tasks',
      description:
        'Each task card shows the task details and provides options to edit, delete, or mark as complete. Use the edit button to modify task details, the delete button to remove tasks, and the check button to mark tasks as complete.',
    },
    {
      label: 'Task Priority',
      description:
        'Tasks in Q1 (Urgent & Important) are your top priorities. Q2 tasks are important for long-term goals. Q3 tasks can often be delegated. Q4 tasks should be minimized or eliminated.',
    },
    {
      label: 'Points System',
      description:
        'Completing tasks earns you points based on their quadrant: Q1 tasks give 15 points, Q2 tasks give 10 points, Q3 tasks give 5 points, and Q4 tasks give 1 point. These points can be used in the Rewards page.',
    },
    {
      label: 'Task Deadlines',
      description:
        "Be careful with task deadlines! If you don't complete a task before its due date, you'll lose points equal to the reward you would have received. For example, missing a Q1 task deadline will cost you 15 points. This encourages timely task completion and helps maintain accountability.",
    },
  ];

  const getQuadrantFromFlags = (isImportant: boolean, isUrgent: boolean): QuadrantId => {
    if (isImportant && isUrgent) return 'q1';
    if (isImportant && !isUrgent) return 'q2';
    if (!isImportant && isUrgent) return 'q3';
    return 'q4';
  };

  const getCurrentQuadrant = () => {
    return getQuadrantFromFlags(taskForm.isImportant, taskForm.isUrgent);
  };

  const getDefaultDeadline = () => {
    const now = new Date();
    now.setHours(23, 59, 0, 0);
    return now.toISOString().split('T')[0];
  };

  const formatDateTime = (dateStr: string, timeStr: string) => {
    if (!dateStr) return '';
    const date = new Date(`${dateStr}T${timeStr}`);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOpen = (task: Task | null = null) => {
    if (task) {
      setEditingTask(task);
      const taskDate = task.dueDate ? new Date(task.dueDate) : null;
      setTaskForm({
        title: task.title,
        description: task.description,
        isImportant: task.quadrant === 'q1' || task.quadrant === 'q2',
        isUrgent: task.quadrant === 'q1' || task.quadrant === 'q3',
        dueDate: taskDate ? taskDate.toISOString().split('T')[0] : '',
        dueTime: taskDate ? taskDate.toTimeString().slice(0, 5) : '23:59',
      });
    } else {
      setEditingTask(null);
      setTaskForm({
        title: '',
        description: '',
        isImportant: false,
        isUrgent: false,
        dueDate: getDefaultDeadline(),
        dueTime: '23:59',
      });
    }
    setOpen(true);
    playSound('notification');
  };

  const handleClose = () => {
    setOpen(false);
    setEditingTask(null);
  };

  const handleSubmit = () => {
    const quadrant = getQuadrantFromFlags(taskForm.isImportant, taskForm.isUrgent);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { isImportant, isUrgent, dueTime, ...fields } = taskForm;
    const taskData = {
      ...fields,
      quadrant,
      dueDate: taskForm.dueDate && dueTime ? `${taskForm.dueDate}T${dueTime}` : null,
    };

    if (editingTask) {
      updateTask(editingTask.id, taskData);
      playSound('notification');
    } else {
      addTask(taskData);
      playSound('start');
    }
    handleClose();
  };

  const handleTaskComplete = (taskId: number) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      const quadrant = quadrants.find((q) => q.id === task.quadrant);
      completeTask(taskId);
      addPoints(quadrant!.points);
      playSound('complete');
    }
  };

  const handleDeleteTask = (taskId: number) => {
    deleteTask(taskId);
    playSound('notification');
  };

  const currentQuadrant = getCurrentQuadrant();
  const currentQuadrantData = quadrants.find((q) => q.id === currentQuadrant)!;

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleReset = () => {
    setActiveStep(0);
  };

  const checkOverdueTasks = () => {
    const now = new Date();
    tasks.forEach((task) => {
      if (!task.completed && task.dueDate) {
        const dueDate = new Date(task.dueDate);
        if (dueDate < now) {
          const quadrant = quadrants.find((q) => q.id === task.quadrant);
          addPoints(-quadrant!.points);
          completeTask(task.id);
          playSound('notification');
        }
      }
    });
  };

  useEffect(() => {
    checkOverdueTasks();
    const interval = setInterval(checkOverdueTasks, 3600000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shortcut: checkOverdueTasks is recreated each render, re-run on tasks only
  }, [tasks]);

  return (
    <Box>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h4">Task List</Typography>
          <Typography variant="body2" color="text.secondary">
            Sort what matters with the Eisenhower matrix
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Help">
            <IconButton onClick={() => setShowHelp(true)} aria-label="Help">
              <HelpIcon />
            </IconButton>
          </Tooltip>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => handleOpen()}>
            Add New Task
          </Button>
        </Box>
      </Box>

      <Grid container spacing={3}>
        {quadrants.map((quadrant) => (
          <Grid item xs={12} md={6} key={quadrant.id}>
            <Paper
              sx={{
                p: 2,
                borderTop: `4px solid ${quadrant.color}`,
                height: '100%',
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Typography variant="h6">{quadrant.title}</Typography>
                <Box
                  sx={{
                    bgcolor: `${quadrant.color}15`,
                    color: quadrant.color,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: '12px',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                  }}
                >
                  {tasks.filter((task) => task.quadrant === quadrant.id && !task.completed).length}
                  <Typography
                    component="span"
                    sx={{
                      fontSize: '0.75rem',
                      opacity: 0.8,
                      ml: 0.5,
                    }}
                  >
                    tasks
                  </Typography>
                </Box>
              </Box>
              <List>
                {tasks
                  .filter((task) => task.quadrant === quadrant.id && !task.completed)
                  .map((task) => (
                    <ListItem
                      key={task.id}
                      sx={{
                        bgcolor: 'background.paper',
                        mb: 1,
                        borderRadius: 2,
                        display: 'flex',
                        flexDirection: { xs: 'column', sm: 'row' },
                        alignItems: { xs: 'stretch', sm: 'center' },
                        gap: 2,
                        p: 2,
                        '&:hover': {
                          bgcolor: 'action.hover',
                        },
                      }}
                    >
                      <ListItemText
                        primary={
                          <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                            {task.title}
                          </Typography>
                        }
                        secondary={
                          <>
                            {task.description}
                            {task.dueDate && (
                              <Typography
                                component="span"
                                variant="body2"
                                color="text.secondary"
                                sx={{ display: 'block', mt: 0.5 }}
                              >
                                Due:{' '}
                                {formatDateTime(
                                  task.dueDate.split('T')[0],
                                  task.dueDate.split('T')[1],
                                )}
                              </Typography>
                            )}
                          </>
                        }
                        sx={{ flex: 1 }}
                      />
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Button
                          variant="contained"
                          color="success"
                          size="medium"
                          onClick={() => handleTaskComplete(task.id)}
                          startIcon={<CheckIcon sx={{ fontSize: '1.2rem' }} />}
                          sx={{
                            flex: { xs: 1, sm: 'none' },
                            minWidth: '110px',
                            height: '38px',
                            fontSize: '0.95rem',
                            '&:hover': {
                              transform: 'translateY(-1px)',
                            },
                            transition: 'all 0.2s ease-in-out',
                          }}
                        >
                          Finish
                        </Button>
                        <IconButton
                          edge="end"
                          aria-label="edit"
                          onClick={() => handleOpen(task)}
                          sx={{
                            color: 'primary.main',
                            '&:hover': {
                              bgcolor: 'primary.lighter',
                            },
                          }}
                        >
                          <EditIcon />
                        </IconButton>
                        <IconButton
                          edge="end"
                          aria-label="delete"
                          onClick={() => handleDeleteTask(task.id)}
                          sx={{
                            color: 'error.main',
                            '&:hover': {
                              bgcolor: 'error.lighter',
                            },
                          }}
                        >
                          <DeleteIcon />
                        </IconButton>
                      </Box>
                    </ListItem>
                  ))}
              </List>
              {!tasks.some((task) => task.quadrant === quadrant.id && !task.completed) && (
                <Typography variant="body2" color="text.secondary" sx={{ px: 1, py: 2 }}>
                  Nothing here. Add a task or enjoy the space.
                </Typography>
              )}
            </Paper>
          </Grid>
        ))}
      </Grid>

      <Dialog open={open} onClose={handleClose}>
        <DialogTitle>{editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField
              fullWidth
              label="Title"
              value={taskForm.title}
              onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
              sx={{ mb: 2 }}
            />
            <TextField
              fullWidth
              label="Description"
              multiline
              rows={3}
              value={taskForm.description}
              onChange={(e) => setTaskForm({ ...taskForm, description: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Task Priority
              </Typography>
              <ToggleButtonGroup
                value={[
                  taskForm.isImportant ? 'important' : null,
                  taskForm.isUrgent ? 'urgent' : null,
                ].filter(Boolean)}
                onChange={(e, newValue) => {
                  const isImportant = newValue.includes('important');
                  const isUrgent = newValue.includes('urgent');
                  setTaskForm({ ...taskForm, isImportant, isUrgent });
                }}
                aria-label="task priority"
              >
                <Tooltip title="Important tasks are those that contribute to long-term goals">
                  <ToggleButton
                    value="important"
                    aria-label="important"
                    sx={{
                      color: taskForm.isImportant ? '#4ecdc4' : 'inherit',
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(78, 205, 196, 0.1)',
                        '&:hover': {
                          backgroundColor: 'rgba(78, 205, 196, 0.2)',
                        },
                      },
                    }}
                  >
                    <StarIcon sx={{ mr: 1 }} />
                    Important
                  </ToggleButton>
                </Tooltip>
                <Tooltip title="Urgent tasks require immediate attention">
                  <ToggleButton
                    value="urgent"
                    aria-label="urgent"
                    sx={{
                      color: taskForm.isUrgent ? '#ff6b6b' : 'inherit',
                      '&.Mui-selected': {
                        backgroundColor: 'rgba(255, 107, 107, 0.1)',
                        '&:hover': {
                          backgroundColor: 'rgba(255, 107, 107, 0.2)',
                        },
                      },
                    }}
                  >
                    <PriorityHighIcon sx={{ mr: 1 }} />
                    Urgent
                  </ToggleButton>
                </Tooltip>
              </ToggleButtonGroup>
              <Box
                sx={{
                  mt: 2,
                  p: 1,
                  borderRadius: 1,
                  backgroundColor: `${currentQuadrantData.color}15`,
                  border: `1px solid ${currentQuadrantData.color}40`,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  This task will be placed in:{' '}
                  <strong style={{ color: currentQuadrantData.color }}>
                    {currentQuadrantData.title}
                  </strong>
                </Typography>
              </Box>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle1" gutterBottom>
                Due Date & Time
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <TextField
                  fullWidth
                  label="Date"
                  type="date"
                  value={taskForm.dueDate}
                  onChange={(e) => setTaskForm({ ...taskForm, dueDate: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
                <TextField
                  fullWidth
                  label="Time"
                  type="time"
                  value={taskForm.dueTime}
                  onChange={(e) => setTaskForm({ ...taskForm, dueTime: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                />
              </Stack>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose}>Cancel</Button>
          <Button onClick={handleSubmit} variant="contained" disabled={!taskForm.title}>
            {editingTask ? 'Update' : 'Add'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={showHelp} onClose={() => setShowHelp(false)} maxWidth="md" fullWidth>
        <DialogTitle>How to Use the Task List</DialogTitle>
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

export default TaskList;
