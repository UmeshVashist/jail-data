/**
 * client/src/context/ThemeContext.jsx - Theme Management (Classic UI vs Modern 3D Cyber UI)
 */

import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  // By default, Classic UI is enforced as requested
  const [theme, setTheme] = useState('classic');

  useEffect(() => {
    localStorage.setItem('informaction_theme', 'classic');
    document.body.classList.remove('theme-modern-3d', 'dark-theme');
    document.body.classList.add('theme-classic');
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

