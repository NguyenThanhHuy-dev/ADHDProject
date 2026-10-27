import { useState, type ReactNode } from 'react';
import {
  Box,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
} from '@mui/material';
import {
  Menu as MenuIcon,
  GridViewRounded as DashboardIcon,
  TimerOutlined as TimerIcon,
  TaskAltRounded as TasksIcon,
  CardGiftcardRounded as RewardsIcon,
  PersonOutlineRounded as ProfileIcon,
  SettingsOutlined as SettingsIcon,
  BoltRounded as LogoIcon,
} from '@mui/icons-material';
import { alpha } from '@mui/material/styles';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 248;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Pomodoro', icon: <TimerIcon />, path: '/pomodoro' },
  { text: 'Tasks', icon: <TasksIcon />, path: '/tasks' },
  { text: 'Rewards', icon: <RewardsIcon />, path: '/rewards' },
  { text: 'Profile', icon: <ProfileIcon />, path: '/profile' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const Layout = ({ children }: { children: ReactNode }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();

  const drawer = (
    <Box sx={{ px: 2, py: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 1, py: 1.5, mb: 2 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2.5,
            display: 'grid',
            placeItems: 'center',
            color: '#fff',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            boxShadow: '0 6px 16px rgba(99,102,241,0.35)',
          }}
        >
          <LogoIcon fontSize="small" />
        </Box>
        <Typography variant="h6" noWrap>
          ADHD Focus
        </Typography>
      </Box>
      <List component="nav" aria-label="Main navigation" sx={{ display: 'grid', gap: 0.5 }}>
        {menuItems.map((item) => {
          const selected = location.pathname === item.path;
          return (
            <ListItemButton
              key={item.text}
              selected={selected}
              onClick={() => {
                navigate(item.path);
                setMobileOpen(false);
              }}
              sx={{
                borderRadius: 2.5,
                py: 1.1,
                color: selected ? 'primary.main' : 'text.secondary',
                '&.Mui-selected': {
                  backgroundColor: alpha(theme.palette.primary.main, 0.1),
                  '&:hover': { backgroundColor: alpha(theme.palette.primary.main, 0.14) },
                },
                '& .MuiListItemIcon-root': { color: 'inherit', minWidth: 40 },
              }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText
                primary={item.text}
                primaryTypographyProps={{ fontWeight: selected ? 600 : 500, fontSize: 15 }}
              />
            </ListItemButton>
          );
        })}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: 'block', md: 'none' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: drawerWidth },
          }}
        >
          {drawer}
        </Drawer>
      </Box>
      <Box component="main" sx={{ flexGrow: 1, minWidth: 0 }}>
        <Toolbar sx={{ display: { md: 'none' }, gap: 1, px: 2 }}>
          <IconButton aria-label="open drawer" edge="start" onClick={() => setMobileOpen(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="subtitle1" noWrap>
            ADHD Focus
          </Typography>
        </Toolbar>
        <Box sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 2, sm: 3, md: 4 }, py: { xs: 1, md: 4 } }}>
          {children}
        </Box>
      </Box>
    </Box>
  );
};

export default Layout;
