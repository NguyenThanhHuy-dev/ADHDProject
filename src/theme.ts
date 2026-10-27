import { alpha, createTheme } from '@mui/material/styles';

const font = '"Inter", "Roboto", "Helvetica", "Arial", sans-serif';

export const createAppTheme = (darkMode: boolean, reducedMotion = false) => {
  const mode = darkMode ? 'dark' : 'light';
  const divider = darkMode ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.08)';

  return createTheme({
    palette: {
      mode,
      primary: { main: '#6366f1', light: '#818cf8', dark: '#4f46e5' },
      secondary: { main: '#ec4899' },
      success: { main: '#10b981' },
      warning: { main: '#f59e0b' },
      error: { main: '#ef4444' },
      background: {
        default: darkMode ? '#0f1117' : '#f6f7fb',
        paper: darkMode ? '#171a23' : '#ffffff',
      },
      text: {
        primary: darkMode ? '#e8eaf0' : '#0f172a',
        secondary: darkMode ? '#9aa3b5' : '#5b6478',
      },
      divider,
    },
    shape: { borderRadius: 14 },
    ...(reducedMotion && { transitions: { create: () => 'none' } }),
    typography: {
      fontFamily: font,
      h4: {
        fontWeight: 700,
        letterSpacing: '-0.02em',
        fontSize: '1.75rem',
        '@media (min-width:600px)': { fontSize: '2.125rem' },
      },
      h5: { fontWeight: 700, letterSpacing: '-0.01em' },
      h6: { fontWeight: 600, letterSpacing: '-0.01em' },
      subtitle1: { fontWeight: 600 },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: { fontFeatureSettings: '"cv11", "ss01"' },
          ...(reducedMotion && {
            '*, *::before, *::after': {
              animation: 'none !important',
              transition: 'none !important',
              scrollBehavior: 'auto !important',
            },
          }),
        },
      },
      MuiButtonBase: { defaultProps: { disableRipple: reducedMotion } },
      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${divider}`,
            boxShadow: darkMode
              ? 'none'
              : '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.04)',
          },
        },
      },
      MuiButton: {
        defaultProps: { disableElevation: true },
        styleOverrides: {
          root: { borderRadius: 10, paddingInline: 18 },
          sizeLarge: { paddingBlock: 11 },
        },
      },
      MuiChip: { styleOverrides: { root: { fontWeight: 600 } } },
      MuiDialog: {
        styleOverrides: {
          paper: { borderRadius: 20, boxShadow: '0 24px 64px rgba(15,23,42,0.25)' },
        },
      },
      MuiTooltip: {
        styleOverrides: { tooltip: { borderRadius: 8, fontSize: 12, fontWeight: 500 } },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: { borderRadius: 10, backgroundColor: alpha('#6366f1', darkMode ? 0.04 : 0.02) },
        },
      },
      MuiDrawer: {
        styleOverrides: { paper: { borderRight: `1px solid ${divider}`, backgroundImage: 'none' } },
      },
    },
  });
};
