'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Theme } from '@/lib/theme';
import { getInitialTheme, saveTheme } from '@/lib/theme';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const initialTheme = getInitialTheme();
    setTheme(initialTheme);
    applyTheme(initialTheme);
    setMounted(true);
  }, []);

  const applyTheme = (newTheme: Theme) => {
    document.documentElement.setAttribute('data-theme', newTheme);
    
    if (newTheme === 'dark') {
      document.body.style.backgroundColor = '#07080f';
      document.body.style.color = '#f1f5f9';
    } else {
      document.body.style.backgroundColor = '#ffffff';
      document.body.style.color = '#1f2937';
    }
  };

  const toggleTheme = () => {
    setTheme((prev) => {
      const newTheme = prev === 'dark' ? 'light' : 'dark';
      saveTheme(newTheme);
      applyTheme(newTheme);
      return newTheme;
    });
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    return {
      theme: 'dark' as const,
      toggleTheme: () => {},
    };
  }
  return context;
}
