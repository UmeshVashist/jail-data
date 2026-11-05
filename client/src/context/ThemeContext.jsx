/**
 * client/src/context/ThemeContext.jsx - Theme Management (Classic UI vs Modern 3D Cyber UI)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('informaction_theme') || 'modern';
  });

  useEffect(() => {
    localStorage.setItem('informaction_theme', theme);
    if (theme === 'modern') {
      document.body.classList.remove('theme-classic');
      document.body.classList.add('theme-modern-3d');
    } else {
      document.body.classList.remove('theme-modern-3d');
      document.body.classList.add('theme-classic');
    }
  }, [theme]);

  const toggleTheme = (newTheme) => {
    if (newTheme) {
      setTheme(newTheme);
    } else {
      setTheme(prev => (prev === 'modern' ? 'classic' : 'modern'));
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isModern: theme === 'modern' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

