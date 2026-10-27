import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Switch,
  FormControlLabel,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
} from '@mui/material';
import {
  VolumeUp as VolumeUpIcon,
  DarkMode as DarkModeIcon,
  Language as LanguageIcon,
  MotionPhotosOffRounded as ReduceMotionIcon,
} from '@mui/icons-material';
import useSoundStore from '../../store/soundStore';
import useThemeStore from '../../store/themeStore';
import PushSettings from './PushSettings';

function Settings() {
  const soundEnabled = useSoundStore((state) => state.soundEnabled);
  const toggleSound = useSoundStore((state) => state.toggleSound);
  const darkMode = useThemeStore((state) => state.darkMode);
  const toggleDarkMode = useThemeStore((state) => state.toggleDarkMode);
  const reducedMotion = useThemeStore((state) => state.reducedMotion);
  const toggleReducedMotion = useThemeStore((state) => state.toggleReducedMotion);

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Paper sx={{ p: 3, mb: 3 }}>
        <Typography variant="h6" gutterBottom>
          Preferences
        </Typography>
        <List>
          <ListItem>
            <ListItemIcon>
              <VolumeUpIcon />
            </ListItemIcon>
            <ListItemText
              primary="Sound Effects"
              secondary="Enable or disable sound effects throughout the app"
            />
            <FormControlLabel
              control={<Switch checked={soundEnabled} onChange={toggleSound} color="primary" />}
              label=""
            />
          </ListItem>
          <Divider />
          <PushSettings />
          <ListItem>
            <ListItemIcon>
              <DarkModeIcon />
            </ListItemIcon>
            <ListItemText primary="Dark Mode" secondary="Switch between light and dark theme" />
            <FormControlLabel
              control={<Switch checked={darkMode} onChange={toggleDarkMode} color="primary" />}
              label=""
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemIcon>
              <ReduceMotionIcon />
            </ListItemIcon>
            <ListItemText
              primary="Reduce motion"
              secondary="Fewer animations and transitions, for less distraction"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={reducedMotion}
                  onChange={toggleReducedMotion}
                  color="primary"
                  inputProps={{ 'aria-label': 'Reduce motion' }}
                />
              }
              label=""
            />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemIcon>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText primary="Language" secondary="Change the app's language" />
            <Typography variant="body2" color="text.secondary">
              English
            </Typography>
          </ListItem>
        </List>
      </Paper>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" gutterBottom>
          About
        </Typography>
        <List>
          <ListItem>
            <ListItemText primary="Version" secondary="1.0.0" />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText primary="Terms of Service" secondary="Read our terms of service" />
          </ListItem>
          <Divider />
          <ListItem>
            <ListItemText primary="Privacy Policy" secondary="Read our privacy policy" />
          </ListItem>
        </List>
      </Paper>
    </Box>
  );
}

export default Settings;
