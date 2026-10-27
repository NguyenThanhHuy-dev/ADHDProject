import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  LinearProgress,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesomeRounded as SparkIcon,
  CloseRounded as RemoveIcon,
  ExpandLessRounded as CollapseIcon,
  ExpandMoreRounded as ExpandIcon,
} from '@mui/icons-material';
import {
  useAddSteps,
  useDeleteStep,
  useFeatures,
  useSuggestSteps,
  useUpdateStep,
} from '../../api/hooks';
import type { Task } from '../../types';

/** A checklist for one task. Ticking steps never completes the task or pays points. */
const TaskSteps = ({ task }: { task: Task }) => {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const addSteps = useAddSteps();
  const updateStep = useUpdateStep();
  const deleteStep = useDeleteStep();
  const suggest = useSuggestSteps();
  const { data: features } = useFeatures();

  const done = task.steps.filter((s) => s.done).length;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const title = draft.trim();
    if (!title) return;
    addSteps.mutate({ taskId: task.id, titles: [title] }, { onSuccess: () => setDraft('') });
  };

  const requestSuggestions = () =>
    suggest.mutate(task.id, {
      onSuccess: ({ steps }) => {
        setSuggestions(steps);
        setPicked(new Set(steps));
      },
    });

  const toggleSuggestion = (step: string) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step);
      else next.add(step);
      return next;
    });

  const addPicked = () => {
    const titles = suggestions?.filter((s) => picked.has(s)) ?? [];
    if (titles.length === 0) return;
    addSteps.mutate(
      { taskId: task.id, titles },
      {
        onSuccess: () => {
          setSuggestions(null);
          setOpen(true);
        },
      },
    );
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Button
          size="small"
          color="inherit"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          endIcon={open ? <CollapseIcon /> : <ExpandIcon />}
          sx={{ color: 'text.secondary' }}
        >
          {task.steps.length ? `Steps ${done}/${task.steps.length}` : 'Add steps'}
        </Button>
        {task.steps.length > 0 && (
          <LinearProgress
            variant="determinate"
            value={(done / task.steps.length) * 100}
            aria-label="Steps done"
            sx={{ flex: 1, minWidth: 60, maxWidth: 160, height: 6, borderRadius: 3 }}
          />
        )}
      </Box>

      <Collapse in={open} unmountOnExit>
        <Box sx={{ pl: 1, pt: 0.5 }}>
          {task.steps.map((step) => (
            <Box key={step.id} sx={{ display: 'flex', alignItems: 'center' }}>
              <FormControlLabel
                sx={{ flex: 1, mr: 0 }}
                control={
                  <Checkbox
                    size="small"
                    checked={step.done}
                    onChange={(e) =>
                      updateStep.mutate({
                        taskId: task.id,
                        stepId: step.id,
                        done: e.target.checked,
                      })
                    }
                  />
                }
                label={
                  <Typography
                    variant="body2"
                    sx={{
                      textDecoration: step.done ? 'line-through' : 'none',
                      color: step.done ? 'text.secondary' : 'text.primary',
                    }}
                  >
                    {step.title}
                  </Typography>
                }
              />
              <IconButton
                size="small"
                aria-label={`Remove step ${step.title}`}
                onClick={() => deleteStep.mutate({ taskId: task.id, stepId: step.id })}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>
            </Box>
          ))}

          <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1, mt: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="Add a small step"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              inputProps={{ maxLength: 120, 'aria-label': 'New step' }}
            />
            <Button type="submit" size="small" disabled={!draft.trim() || addSteps.isPending}>
              Add
            </Button>
          </Box>
          {addSteps.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {addSteps.error.message}
            </Alert>
          )}

          {features?.aiSteps && (
            <Button
              size="small"
              startIcon={suggest.isPending ? <CircularProgress size={14} /> : <SparkIcon />}
              onClick={requestSuggestions}
              disabled={suggest.isPending}
              sx={{ mt: 1 }}
            >
              Suggest steps with AI
            </Button>
          )}
          {suggest.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {suggest.error.message}
            </Alert>
          )}
        </Box>
      </Collapse>

      <Dialog
        open={suggestions !== null}
        onClose={() => setSuggestions(null)}
        fullWidth
        maxWidth="xs"
      >
        <DialogTitle>Suggested steps</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Pick the ones you want. Nothing is saved until you add them.
          </Typography>
          {suggestions?.map((step) => (
            <FormControlLabel
              key={step}
              sx={{ display: 'flex', alignItems: 'flex-start' }}
              control={
                <Checkbox
                  size="small"
                  checked={picked.has(step)}
                  onChange={() => toggleSuggestion(step)}
                />
              }
              label={<Typography variant="body2">{step}</Typography>}
            />
          ))}
          {addSteps.isError && (
            <Alert severity="error" sx={{ mt: 1 }}>
              {addSteps.error.message}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSuggestions(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={addPicked}
            disabled={picked.size === 0 || addSteps.isPending}
          >
            Add {picked.size} step{picked.size === 1 ? '' : 's'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default TaskSteps;
