// frontend/src/components/ThemeToggle.jsx
import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      className="p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
      style={{
        backgroundColor: isDark ? 'var(--bg-input)' : '#f3f4f6',
        color: isDark ? 'var(--text-primary)' : '#374151'
      }}
      title={isDark ? 'Modo claro' : 'Modo oscuro'}
    >
      {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
};

export default ThemeToggle;