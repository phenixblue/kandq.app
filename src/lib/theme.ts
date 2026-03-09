export type Theme = 'light' | 'dark';

export const THEME_STORAGE_KEY = 'kandq-theme';

export function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') {
    return stored;
  }
  return 'dark';
}

export function saveTheme(theme: Theme): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  }
}
