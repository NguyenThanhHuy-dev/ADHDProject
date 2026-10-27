import useThemeStore from './themeStore';
import { createAppTheme } from '../theme';

describe('theme preferences', () => {
  it('saves the choices so they survive a reload', () => {
    useThemeStore.setState({ darkMode: false, reducedMotion: false });
    useThemeStore.getState().toggleDarkMode();
    useThemeStore.getState().toggleReducedMotion();
    const saved = JSON.parse(localStorage.getItem('ui-preferences')!);
    expect(saved.state).toMatchObject({ darkMode: true, reducedMotion: true });
  });

  it('reduced motion removes transitions, ripples and CSS animations from the theme', () => {
    const calm = createAppTheme(false, true);
    expect(calm.transitions.create('opacity')).toBe('none');
    expect(calm.components?.MuiButtonBase?.defaultProps?.disableRipple).toBe(true);
    expect(JSON.stringify(calm.components?.MuiCssBaseline?.styleOverrides)).toContain('animation');

    const lively = createAppTheme(false, false);
    expect(lively.transitions.create('opacity')).not.toBe('none');
    expect(lively.components?.MuiButtonBase?.defaultProps?.disableRipple).toBe(false);
  });
});
