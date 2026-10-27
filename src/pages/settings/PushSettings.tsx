import {
  Alert,
  Box,
  Button,
  Divider,
  FormControlLabel,
  ListItem,
  ListItemIcon,
  ListItemText,
  Switch,
} from '@mui/material';
import { Notifications as NotificationsIcon } from '@mui/icons-material';
import {
  usePushDevice,
  usePushSettings,
  useSendTestPush,
  useUpdatePushSettings,
} from '../../api/push';

/** Push notifications: turn them on for this browser and pick which reminders to get. */
const PushSettings = () => {
  const device = usePushDevice();
  const { data: settings } = usePushSettings();
  const update = useUpdatePushSettings();
  const test = useSendTestPush();

  const serverReady = settings?.available ?? false;
  const blocked = device.permission === 'denied' && !device.subscribed;
  const unavailable = !device.supported || !serverReady;

  const secondary = !device.supported
    ? 'This browser cannot receive push notifications. On iPhone, add the app to your Home Screen first.'
    : !serverReady
      ? 'Notifications are not set up on this server.'
      : blocked
        ? 'Blocked in your browser settings for this site.'
        : 'Reminders for tasks that are due soon and for finished focus sessions';

  return (
    <>
      <ListItem>
        <ListItemIcon>
          <NotificationsIcon />
        </ListItemIcon>
        <ListItemText primary="Push notifications" secondary={secondary} />
        <FormControlLabel
          control={
            <Switch
              checked={device.subscribed}
              disabled={unavailable || blocked || device.busy}
              onChange={(_, on) => void (on ? device.enable() : device.disable())}
              color="primary"
              inputProps={{ 'aria-label': 'Push notifications' }}
            />
          }
          label=""
        />
      </ListItem>

      {device.error && (
        <Box sx={{ px: 2, pb: 1 }}>
          <Alert severity="error">{device.error}</Alert>
        </Box>
      )}

      {device.subscribed && settings && (
        <Box sx={{ px: 2, pb: 2, pl: 9 }}>
          <FormControlLabel
            sx={{ display: 'flex' }}
            control={
              <Switch
                size="small"
                checked={settings.dueReminders}
                onChange={(_, on) => update.mutate({ dueReminders: on })}
                inputProps={{ 'aria-label': 'Remind me when a task is due soon' }}
              />
            }
            label="Remind me when a task is due within the hour"
          />
          <FormControlLabel
            sx={{ display: 'flex' }}
            control={
              <Switch
                size="small"
                checked={settings.timerEnd}
                onChange={(_, on) => update.mutate({ timerEnd: on })}
                inputProps={{ 'aria-label': 'Tell me when a focus session ends' }}
              />
            }
            label="Tell me when a focus session ends"
          />
          <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 2 }}>
            <Button
              size="small"
              variant="outlined"
              onClick={() => test.mutate()}
              disabled={test.isPending}
            >
              Send a test notification
            </Button>
            {test.isSuccess && (
              <Alert severity={test.data.sent > 0 ? 'success' : 'warning'} sx={{ py: 0 }}>
                {test.data.sent > 0
                  ? 'Sent. It should appear in a moment.'
                  : 'Nothing was delivered. Try turning notifications off and on again.'}
              </Alert>
            )}
            {test.isError && (
              <Alert severity="error" sx={{ py: 0 }}>
                {test.error.message}
              </Alert>
            )}
          </Box>
        </Box>
      )}
      <Divider />
    </>
  );
};

export default PushSettings;
