'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorTheme {
  name: string;
  accent: string;
  accentDark: string;
  accentLight: string;
}

export const COLOR_THEMES: ColorTheme[] = [
  { name: 'LINE Green', accent: '#06C755', accentDark: '#05a847', accentLight: '#4cd880' },
  { name: 'Blue', accent: '#3B82F6', accentDark: '#2563EB', accentLight: '#60A5FA' },
  { name: 'Purple', accent: '#8B5CF6', accentDark: '#7C3AED', accentLight: '#A78BFA' },
  { name: 'Rose', accent: '#F43F5E', accentDark: '#E11D48', accentLight: '#FB7185' },
  { name: 'Orange', accent: '#F97316', accentDark: '#EA580C', accentLight: '#FB923C' },
  { name: 'Teal', accent: '#14B8A6', accentDark: '#0D9488', accentLight: '#2DD4BF' },
];

interface ThemeContextType {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  isDark: boolean;
  colorTheme: ColorTheme;
  setColorTheme: (theme: ColorTheme) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'light',
  setMode: () => {},
  isDark: false,
  colorTheme: COLOR_THEMES[0],
  setColorTheme: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

function getSystemDark(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(COLOR_THEMES[0]);
  const [mounted, setMounted] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedMode = localStorage.getItem('theme-mode') as ThemeMode | null;
    const savedColor = localStorage.getItem('theme-color');

    if (savedMode) setModeState(savedMode);
    if (savedColor) {
      try {
        const parsed = JSON.parse(savedColor);
        if (parsed.accent) setColorThemeState(parsed);
      } catch {}
    }
    setMounted(true);
  }, []);

  // Compute isDark
  const isDark = mode === 'dark' || (mode === 'system' && getSystemDark());

  // Apply dark class to <html>
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    if (isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [isDark, mounted]);

  // Apply CSS variables for accent color
  useEffect(() => {
    if (!mounted) return;
    const root = document.documentElement;
    root.style.setProperty('--accent', colorTheme.accent);
    root.style.setProperty('--accent-dark', colorTheme.accentDark);
    root.style.setProperty('--accent-light', colorTheme.accentLight);
  }, [colorTheme, mounted]);

  // Listen for system theme changes
  useEffect(() => {
    if (mode !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => {
      const root = document.documentElement;
      if (mq.matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  const setMode = useCallback((newMode: ThemeMode) => {
    setModeState(newMode);
    localStorage.setItem('theme-mode', newMode);
  }, []);

  const setColorTheme = useCallback((theme: ColorTheme) => {
    setColorThemeState(theme);
    localStorage.setItem('theme-color', JSON.stringify(theme));
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, setMode, isDark, colorTheme, setColorTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
