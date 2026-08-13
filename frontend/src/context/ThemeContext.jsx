// frontend/src/context/ThemeContext.jsx
import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const COLOR_PALETTES = {
    azul: {
        primary: [59, 130, 246],
        hover: [37, 99, 235],
        text: '#3b82f6',
    },
    verde: {
        primary: [34, 197, 94],
        hover: [22, 163, 74],
        text: '#22c55e',
    },
    morado: {
        primary: [139, 92, 246],
        hover: [124, 58, 237],
        text: '#8b5cf6',
    },
    rojo: {
        primary: [239, 68, 68],
        hover: [220, 38, 38],
        text: '#ef4444',
    },
    naranja: {
        primary: [251, 146, 60],
        hover: [234, 88, 12],
        text: '#fb923c',
    },
    rosa: {
        primary: [236, 72, 153],
        hover: [219, 39, 119],
        text: '#ec4899',
    },
    amarillo: {
        primary: [234, 179, 8],
        hover: [202, 138, 4],
        text: '#eab308',
    },
    cyan: {
        primary: [6, 182, 212],
        hover: [8, 145, 178],
        text: '#06b6d4',
    },
};

const FONT_FAMILIES = {
    inter: {
        name: 'Inter',
        value: "'Inter', system-ui, sans-serif",
    },
    roboto: {
        name: 'Roboto',
        value: "'Roboto', system-ui, sans-serif",
    },
    poppins: {
        name: 'Poppins',
        value: "'Poppins', system-ui, sans-serif",
    },
    montserrat: {
        name: 'Montserrat',
        value: "'Montserrat', system-ui, sans-serif",
    },
    opensans: {
        name: 'Open Sans',
        value: "'Open Sans', system-ui, sans-serif",
    },
    lato: {
        name: 'Lato',
        value: "'Lato', system-ui, sans-serif",
    },
    nunito: {
        name: 'Nunito',
        value: "'Nunito', system-ui, sans-serif",
    },
    quicksand: {
        name: 'Quicksand',
        value: "'Quicksand', system-ui, sans-serif",
    },
};

/*
 * IMPORTANTE:
 * Estos tamaños cambian el tamaño base del texto mediante una variable CSS.
 * NO modificamos font-size de <html>, por lo que rem, Tailwind y los
 * breakpoints responsive conservan sus medidas originales.
 */
const FONT_SIZES = {
    small: { name: 'Pequeña', value: '13px' },
    medium: { name: 'Mediana', value: '15px' },
    large: { name: 'Grande', value: '17px' },
    xlarge: { name: 'Muy Grande', value: '19px' },
};

const DEFAULT_COLOR = 'azul';
const DEFAULT_FONT = 'inter';
const DEFAULT_SIZE = 'medium';

const hexToRgb = (hex) => {
    const normalized = String(hex || '').replace('#', '');

    if (!/^[0-9a-fA-F]{6}$/.test(normalized)) {
        return null;
    }

    return {
        r: parseInt(normalized.slice(0, 2), 16),
        g: parseInt(normalized.slice(2, 4), 16),
        b: parseInt(normalized.slice(4, 6), 16),
    };
};

const darkenRgb = (r, g, b, amount = 0.12) => [
    Math.max(0, Math.round(r * (1 - amount))),
    Math.max(0, Math.round(g * (1 - amount))),
    Math.max(0, Math.round(b * (1 - amount))),
];

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        return localStorage.getItem('theme') || 'dark';
    });

    const [color, setColor] = useState(() => {
        return localStorage.getItem('themeColor') || DEFAULT_COLOR;
    });

    const [customColor, setCustomColor] = useState(() => {
        return localStorage.getItem('customColor') || '#3b82f6';
    });

    const [fontFamily, setFontFamily] = useState(() => {
        return localStorage.getItem('fontFamily') || DEFAULT_FONT;
    });

    const [fontSize, setFontSize] = useState(() => {
        return localStorage.getItem('fontSize') || DEFAULT_SIZE;
    });
    const [fontBold, setFontBold] = useState(() => {
        return localStorage.getItem('fontBold') === 'true';
    });

    const [fontItalic, setFontItalic] = useState(() => {
        return localStorage.getItem('fontItalic') === 'true';
    });

    // Aplicar negrita
    useEffect(() => {
        const root = document.documentElement;

        root.style.setProperty(
            '--font-weight-base',
            fontBold ? '700' : '400'
        );

        localStorage.setItem(
            'fontBold',
            String(fontBold)
        );
    }, [fontBold]);

    // Aplicar cursiva
    useEffect(() => {
        const root = document.documentElement;

        root.style.setProperty(
            '--font-style-base',
            fontItalic ? 'italic' : 'normal'
        );

        localStorage.setItem(
            'fontItalic',
            String(fontItalic)
        );
    }, [fontItalic]);
    // Tema claro  / oscuro
    useEffect(() => {
        const root = document.documentElement;

        root.classList.remove('light', 'dark');
        root.classList.add(theme);

        localStorage.setItem('theme', theme);
    }, [theme]);

    // Color principal
    useEffect(() => {
        const root = document.documentElement;

        let primary;
        let hover;
        let hex;

        if (color === 'custom') {
            const rgb = hexToRgb(customColor);

            // Mientras el usuario escribe un HEX incompleto, conservamos el último
            // color válido en pantalla y no rompemos las variables CSS.
            if (!rgb) return;

            primary = [rgb.r, rgb.g, rgb.b];
            hover = darkenRgb(rgb.r, rgb.g, rgb.b);
            hex = customColor;

            localStorage.setItem('customColor', customColor);
        } else {
            const palette = COLOR_PALETTES[color];
            if (!palette) return;

            primary = palette.primary;
            hover = palette.hover;
            hex = palette.text;
        }

        const primaryRgb = primary.join(', ');
        const hoverRgb = hover.join(', ');

        root.style.setProperty('--color-primary', `rgb(${primaryRgb})`);
        root.style.setProperty('--color-primary-rgb', primaryRgb);
        root.style.setProperty('--color-primary-hex', hex);
        root.style.setProperty('--color-primary-hover', `rgb(${hoverRgb})`);
        root.style.setProperty('--color-primary-light', `rgba(${primaryRgb}, 0.15)`);

        localStorage.setItem('themeColor', color);
    }, [color, customColor]);

    // Fuente global
    useEffect(() => {
        const root = document.documentElement;
        const font = FONT_FAMILIES[fontFamily];

        if (!font) return;

        root.style.setProperty('--font-family', font.value);
        localStorage.setItem('fontFamily', fontFamily);
    }, [fontFamily]);

    // Tamaño base global SIN tocar el font-size de <html>
    useEffect(() => {
        const root = document.documentElement;
        const size = FONT_SIZES[fontSize];

        if (!size) return;

        root.style.setProperty('--font-size-base', size.value);
        localStorage.setItem('fontSize', fontSize);
    }, [fontSize]);
    const toggleFontBold = () => {
        setFontBold(prev => !prev);
    };

    const toggleFontItalic = () => {
        setFontItalic(prev => !prev);
    };
    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
    };

    const changeColor = (newColor) => {
        if (newColor === 'custom' || COLOR_PALETTES[newColor]) {
            setColor(newColor);
        }
    };

    const changeCustomColor = (newColor) => {
        setCustomColor(newColor);
        setColor('custom');
    };

    const changeFontFamily = (newFont) => {
        if (FONT_FAMILIES[newFont]) {
            setFontFamily(newFont);
        }
    };

    const changeFontSize = (newSize) => {
        if (FONT_SIZES[newSize]) {
            setFontSize(newSize);
        }
    };

    const getColor = () => {
        if (color === 'custom') return customColor;
        return COLOR_PALETTES[color]?.text || '#3b82f6';
    };

    const value = {
        theme,
        color,
        customColor,
        fontFamily,
        fontSize,
        fontBold,
        fontItalic,

        toggleTheme,
        changeColor,
        changeCustomColor,
        changeFontFamily,
        changeFontSize,
        toggleFontBold,
        toggleFontItalic,

        COLOR_PALETTES,
        FONT_FAMILIES,
        FONT_SIZES,

        isDark: theme === 'dark',
        getColor,
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

export default ThemeContext;
