// frontend/src/context/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

// Colores predefinidos
const COLOR_PALETTES = {
    azul: { primary: [59, 130, 246], hover: [37, 99, 235], light: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    verde: { primary: [34, 197, 94], hover: [22, 163, 74], light: 'rgba(34, 197, 94, 0.15)', text: '#22c55e' },
    morado: { primary: [139, 92, 246], hover: [124, 58, 237], light: 'rgba(139, 92, 246, 0.15)', text: '#8b5cf6' },
    rojo: { primary: [239, 68, 68], hover: [220, 38, 38], light: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    naranja: { primary: [251, 146, 60], hover: [234, 88, 12], light: 'rgba(251, 146, 60, 0.15)', text: '#fb923c' },
    rosa: { primary: [236, 72, 153], hover: [219, 39, 119], light: 'rgba(236, 72, 153, 0.15)', text: '#ec4899' },
    amarillo: { primary: [234, 179, 8], hover: [202, 138, 4], light: 'rgba(234, 179, 8, 0.15)', text: '#eab308' },
    cyan: { primary: [6, 182, 212], hover: [8, 145, 178], light: 'rgba(6, 182, 212, 0.15)', text: '#06b6d4' },
};

const DEFAULT_COLOR = 'azul';

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem('theme');
        return saved || 'dark';
    });

    const [color, setColor] = useState(() => {
        const saved = localStorage.getItem('themeColor');
        return saved || DEFAULT_COLOR;
    });

    const [customColor, setCustomColor] = useState(() => {
        const saved = localStorage.getItem('customColor');
        return saved || '#3b82f6';
    });

    // Aplicar tema
    useEffect(() => {
        const root = document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    // Aplicar color
    useEffect(() => {
        const root = document.documentElement;
        let rgb, hex;

        if (color === 'custom' && customColor) {
            const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(customColor);
            if (result) {
                const r = parseInt(result[1], 16);
                const g = parseInt(result[2], 16);
                const b = parseInt(result[3], 16);
                rgb = `${r}, ${g}, ${b}`;
                hex = customColor;
            }
        } else if (COLOR_PALETTES[color]) {
            const c = COLOR_PALETTES[color];
            rgb = c.primary.join(', ');
            hex = c.text;
        }

        if (rgb) {
            root.style.setProperty('--color-primary', `rgb(${rgb})`);
            root.style.setProperty('--color-primary-rgb', rgb);
            root.style.setProperty('--color-primary-hex', hex);
            localStorage.setItem('themeColor', color);
        }
    }, [color, customColor]);

    const toggleTheme = () => {
        setTheme(prev => prev === 'dark' ? 'light' : 'dark');
    };

    const changeColor = (newColor) => {
        setColor(newColor);
    };

    const changeCustomColor = (newColor) => {
        setCustomColor(newColor);
        setColor('custom');
    };

    const value = {
        theme,
        color,
        customColor,
        toggleTheme,
        changeColor,
        changeCustomColor,
        COLOR_PALETTES,
        isDark: theme === 'dark',
        getColor: () => {
            if (color === 'custom') return customColor;
            return COLOR_PALETTES[color]?.text || '#3b82f6';
        }
    };

    return (
        <ThemeContext.Provider value={value}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme debe usarse dentro de ThemeProvider');
    }
    return context;
}