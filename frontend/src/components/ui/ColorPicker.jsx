// frontend/src/components/ui/ColorPicker.jsx
import React, { useEffect, useRef, useState } from 'react';
import { Check, Palette, Text, Type, X } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const COLOR_NAMES = {
    azul: 'Azul',
    verde: 'Verde',
    morado: 'Morado',
    rojo: 'Rojo',
    naranja: 'Naranja',
    rosa: 'Rosa',
    amarillo: 'Amarillo',
    cyan: 'Cyan',
};

const COLOR_HEX = {
    azul: '#3b82f6',
    verde: '#22c55e',
    morado: '#8b5cf6',
    rojo: '#ef4444',
    naranja: '#fb923c',
    rosa: '#ec4899',
    amarillo: '#eab308',
    cyan: '#06b6d4',
};

const ColorPicker = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('colors');
    const dropdownRef = useRef(null);

    const {
        color,
        customColor,
        fontFamily,
        fontSize,
        fontBold,
        fontItalic,

        changeColor,
        changeCustomColor,
        changeFontFamily,
        changeFontSize,
        toggleFontBold,
        toggleFontItalic,

        COLOR_PALETTES,
        FONT_FAMILIES,
        FONT_SIZES,
        getColor
    } = useTheme();

    const [localColor, setLocalColor] = useState(customColor || '#3b82f6');

    useEffect(() => {
        setLocalColor(customColor || '#3b82f6');
    }, [customColor]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target)
            ) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleColorSelect = (colorKey) => {
        changeColor(colorKey);
        setIsOpen(false);
    };

    const handleCustomColorChange = (event) => {
        const newColor = event.target.value;
        setLocalColor(newColor);
        changeCustomColor(newColor);
    };

    const currentColor =
        color === 'custom'
            ? customColor
            : COLOR_HEX[color] || getColor();

    const tabs = [
        { id: 'colors', label: 'Colores', icon: Palette },
        { id: 'fonts', label: 'Fuente', icon: Type },
        { id: 'size', label: 'Tamaño', icon: Text },
    ];

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className="relative p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{
                    backgroundColor: 'var(--bg-input)',
                    color: 'var(--text-muted)',
                }}
                aria-label="Personalizar apariencia"
                aria-expanded={isOpen}
            >
                <div
                    className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                    style={{
                        backgroundColor: currentColor,
                        borderColor: 'var(--border-color)',
                    }}
                />
            </button>

            {isOpen && (
                <div
                    className="absolute right-0 mt-2 rounded-2xl border p-4 z-50 overflow-y-auto"
                    style={{
                        width: 'min(20rem, calc(100vw - 1rem))',
                        maxHeight: 'calc(100dvh - 5rem)',
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border-color)',
                        boxShadow: 'var(--shadow-lg)',
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between mb-3">
                        <h4
                            className="text-sm font-semibold"
                            style={{ color: 'var(--text-primary)' }}
                        >
                            Personalizar
                        </h4>

                        <button
                            type="button"
                            onClick={() => setIsOpen(false)}
                            className="icon-button !w-8 !h-8 !min-w-8 !min-h-8"
                            aria-label="Cerrar personalización"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div
                        className="flex gap-1 mb-4 rounded-lg p-0.5"
                        style={{ backgroundColor: 'var(--bg-hover)' }}
                    >
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = activeTab === tab.id;

                            return (
                                <button
                                    type="button"
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className="flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5"
                                    style={{
                                        color: isActive
                                            ? 'var(--color-primary)'
                                            : 'var(--text-muted)',
                                        backgroundColor: isActive
                                            ? 'var(--bg-card)'
                                            : 'transparent',
                                        boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                                    }}
                                >
                                    <Icon className="w-3.5 h-3.5" />
                                    {tab.label}
                                </button>
                            );
                        })}
                    </div>

                    {/* Colores */}
                    {activeTab === 'colors' && (
                        <>
                            <div className="grid grid-cols-4 gap-2 mb-4">
                                {Object.entries(COLOR_PALETTES).map(([key, value]) => {
                                    const isSelected = color === key;

                                    return (
                                        <button
                                            type="button"
                                            key={key}
                                            onClick={() => handleColorSelect(key)}
                                            className="w-full aspect-square rounded-xl border-2 transition-all flex items-center justify-center"
                                            style={{
                                                backgroundColor: `rgb(${value.primary.join(',')})`,
                                                borderColor: isSelected
                                                    ? 'var(--text-primary)'
                                                    : 'var(--border-color)',
                                                boxShadow: isSelected
                                                    ? '0 0 0 2px var(--bg-card), 0 0 0 4px var(--color-primary)'
                                                    : 'none',
                                            }}
                                            title={COLOR_NAMES[key] || key}
                                            aria-label={`Usar color ${COLOR_NAMES[key] || key}`}
                                        >
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-white drop-shadow-md" />
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div
                                className="border-t my-3"
                                style={{ borderColor: 'var(--border-color)' }}
                            />

                            <div className="flex items-end gap-3">
                                <div className="flex-1 min-w-0">
                                    <label
                                        className="block text-xs mb-1"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        Color personalizado
                                    </label>

                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={localColor}
                                            onChange={handleCustomColorChange}
                                            className="!w-10 !h-10 !min-w-10 rounded-lg cursor-pointer border !p-1 flex-shrink-0"
                                            style={{
                                                borderColor: 'var(--border-color)',
                                                backgroundColor: 'var(--bg-input)',
                                            }}
                                            aria-label="Seleccionar color personalizado"
                                        />

                                        <input
                                            type="text"
                                            value={localColor}
                                            onChange={handleCustomColorChange}
                                            className="flex-1 min-w-0"
                                            placeholder="#3b82f6"
                                            aria-label="Código hexadecimal del color"
                                        />
                                    </div>
                                </div>

                                <div
                                    className="w-10 h-10 rounded-xl border-2 flex-shrink-0"
                                    style={{
                                        backgroundColor: localColor,
                                        borderColor: 'var(--border-color)',
                                    }}
                                />
                            </div>
                        </>
                    )}

                    {/* Fuentes */}
                    {activeTab === 'fonts' && (
                        <div className="space-y-2">
                            {Object.entries(FONT_FAMILIES).map(([key, font]) => {
                                const isSelected = fontFamily === key;

                                return (
                                    <button
                                        type="button"
                                        key={key}
                                        onClick={() => {
                                            changeFontFamily(key);
                                            setIsOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg border transition-all"
                                        style={{
                                            fontFamily: font.value,
                                            borderColor: isSelected
                                                ? 'var(--color-primary)'
                                                : 'var(--border-color)',
                                            backgroundColor: isSelected
                                                ? 'var(--color-primary-light)'
                                                : 'var(--bg-card)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span style={{ color: 'var(--text-primary)' }}>
                                                {font.name}
                                            </span>

                                            {isSelected && (
                                                <Check
                                                    className="w-4 h-4"
                                                    style={{ color: 'var(--color-primary)' }}
                                                />
                                            )}
                                        </div>

                                        <div
                                            className="text-xs mt-1"
                                            style={{ color: 'var(--text-muted)' }}
                                        >
                                            The quick brown fox jumps over the lazy dog
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Tamaños */}
                    {activeTab === 'size' && (
                        <div className="space-y-2">
                            {Object.entries(FONT_SIZES).map(([key, size]) => {
                                const isSelected = fontSize === key;

                                return (
                                    <button
                                        type="button"
                                        key={key}
                                        onClick={() => {
                                            changeFontSize(key);
                                            setIsOpen(false);
                                        }}
                                        className="w-full text-left px-3 py-2 rounded-lg border transition-all"
                                        style={{
                                            borderColor: isSelected
                                                ? 'var(--color-primary)'
                                                : 'var(--border-color)',
                                            backgroundColor: isSelected
                                                ? 'var(--color-primary-light)'
                                                : 'var(--bg-card)',
                                        }}
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <span
                                                style={{
                                                    color: 'var(--text-primary)',
                                                    fontSize: size.value,
                                                }}
                                            >
                                                {size.name}
                                            </span>

                                            <span
                                                className="text-xs"
                                                style={{ color: 'var(--text-muted)' }}
                                            >
                                                {size.value}
                                            </span>
                                        </div>

                                        <div
                                            className="mt-1"
                                            style={{
                                                color: 'var(--text-muted)',
                                                fontSize: size.value,
                                            }}
                                        >
                                            Este es un texto de ejemplo con este tamaño
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {/* Resumen */}
                    <div
                        className="mt-3 pt-3 border-t space-y-1"
                        style={{ borderColor: 'var(--border-color)' }}
                    >
                        <div
                            className="flex items-center justify-between gap-3 text-xs"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <span>Color actual</span>
                            <span
                                className="font-mono"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                {currentColor}
                            </span>
                        </div>

                        <div
                            className="flex items-center justify-between gap-3 text-xs"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <span>Fuente</span>
                            <span style={{ color: 'var(--text-primary)' }}>
                                {FONT_FAMILIES[fontFamily]?.name || 'Inter'}
                            </span>
                        </div>

                        <div
                            className="flex items-center justify-between gap-3 text-xs"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <span>Tamaño</span>
                            <span style={{ color: 'var(--text-primary)' }}>
                                {FONT_SIZES[fontSize]?.name || 'Mediana'}
                            </span>
                        </div>
                        <div
                            className="mt-4 pt-4 border-t"
                            style={{ borderColor: 'var(--border-color)' }}
                        >
                            <p
                                className="text-xs font-semibold mb-2"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                Estilo
                            </p>

                            <div className="grid grid-cols-2 gap-2">

                                {/* NEGRITA */}
                                <button
                                    type="button"
                                    onClick={toggleFontBold}
                                    className="px-3 py-2 rounded-lg border transition-all"
                                    style={{
                                        borderColor: fontBold
                                            ? 'var(--color-primary)'
                                            : 'var(--border-color)',

                                        backgroundColor: fontBold
                                            ? 'var(--color-primary-light)'
                                            : 'var(--bg-input)',

                                        color: fontBold
                                            ? 'var(--color-primary)'
                                            : 'var(--text-primary)',

                                        fontWeight: 700
                                    }}
                                >
                                    B Negrita
                                </button>

                                {/* CURSIVA */}
                                <button
                                    type="button"
                                    onClick={toggleFontItalic}
                                    className="px-3 py-2 rounded-lg border transition-all"
                                    style={{
                                        borderColor: fontItalic
                                            ? 'var(--color-primary)'
                                            : 'var(--border-color)',

                                        backgroundColor: fontItalic
                                            ? 'var(--color-primary-light)'
                                            : 'var(--bg-input)',

                                        color: fontItalic
                                            ? 'var(--color-primary)'
                                            : 'var(--text-primary)',

                                        fontStyle: 'italic'
                                    }}
                                >
                                    I Cursiva
                                </button>

                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColorPicker;
