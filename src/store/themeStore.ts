import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  darkMode: boolean;
  /** Turns off transitions, ripples and chart animations (helps with distraction and motion sensitivity). */
  reducedMotion: boolean;
  toggleDarkMode: () => void;
  toggleReducedMotion: () => void;
}

const prefers = (query: string) =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia(query).matches
    : false;

// First visit follows the operating system; after that the saved choice wins.
const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      darkMode: prefers('(prefers-color-scheme: dark)'),
      reducedMotion: prefers('(prefers-reduced-motion: reduce)'),
      toggleDarkMode: () => set((state) => ({ darkMode: !state.darkMode })),
      toggleReducedMotion: () => set((state) => ({ reducedMotion: !state.reducedMotion })),
    }),
    { name: 'ui-preferences' },
  ),
);

export default useThemeStore;
