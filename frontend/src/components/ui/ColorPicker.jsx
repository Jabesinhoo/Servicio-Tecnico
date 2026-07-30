// frontend/src/components/ui/ColorPicker.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Palette, X, Check } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const ColorPicker = () => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const { color, customColor, changeColor, changeCustomColor, COLOR_PALETTES, getColor } = useTheme();
    const [localColor, setLocalColor] = useState(customColor || '#3b82f6');

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const colorNames = {
        azul: 'Azul',
        verde: 'Verde',
        morado: 'Morado',
        rojo: 'Rojo',
        naranja: 'Naranja',
        rosa: 'Rosa',
        amarillo: 'Amarillo',
        cyan: 'Cyan',
    };

    const colorHex = {
        azul: '#3b82f6',
        verde: '#22c55e',
        morado: '#8b5cf6',
        rojo: '#ef4444',
        naranja: '#fb923c',
        rosa: '#ec4899',
        amarillo: '#eab308',
        cyan: '#06b6d4',
    };

    const handleColorSelect = (colorKey) => {
        changeColor(colorKey);
        setIsOpen(false);
    };

    const handleCustomColorChange = (e) => {
        const newColor = e.target.value;
        setLocalColor(newColor);
        changeCustomColor(newColor);
    };

    const currentColor = color === 'custom' ? customColor : colorHex[color];

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2.5 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-muted)' }}
                aria-label="Selector de colores"
            >
                <div 
                    className="w-5 h-5 rounded-full border-2 flex-shrink-0"
                    style={{ 
                        backgroundColor: currentColor,
                        borderColor: 'var(--border-color)'
                    }}
                />
            </button>

            {isOpen && (
                <div 
                    className="absolute right-0 mt-2 w-72 rounded-2xl shadow-2xl border p-4 z-50"
                    style={{
                        backgroundColor: 'var(--bg-card)',
                        borderColor: 'var(--border-color)',
                        boxShadow: 'var(--shadow-lg)'
                    }}
                >
                    <div className="flex items-center justify-between mb-3">
                        <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                            Color de la plataforma
                        </h4>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-1 rounded-lg transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Colores predefinidos */}
                    <div className="grid grid-cols-4 gap-2 mb-4">
                        {Object.entries(COLOR_PALETTES).map(([key, value]) => (
                            <button
                                key={key}
                                onClick={() => handleColorSelect(key)}
                                className={`w-full aspect-square rounded-xl border-2 transition-all ${
                                    color === key 
                                        ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-400'
                                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-400'
                                }`}
                                style={{ 
                                    backgroundColor: `rgb(${value.primary.join(',')})`,
                                    borderColor: color === key ? 'var(--color-primary)' : 'var(--border-color)'
                                }}
                                title={colorNames[key] || key}
                            >
                                {color === key && (
                                    <Check className="w-4 h-4 mx-auto text-white drop-shadow-md" />
                                )}
                            </button>
                        ))}
                    </div>

                    {/* Separador */}
                    <div className="border-t my-3" style={{ borderColor: 'var(--border-color)' }} />

                    {/* Color personalizado */}
                    <div className="flex items-center gap-3">
                        <div className="flex-1">
                            <label className="block text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                Color personalizado
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={localColor}
                                    onChange={handleCustomColorChange}
                                    className="w-10 h-10 rounded-lg cursor-pointer border p-1"
                                    style={{
                                        borderColor: 'var(--border-color)',
                                        backgroundColor: 'var(--bg-input)'
                                    }}
                                />
                                <input
                                    type="text"
                                    value={localColor}
                                    onChange={handleCustomColorChange}
                                    className="flex-1 px-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-1"
                                    style={{
                                        borderColor: 'var(--border-color)',
                                        backgroundColor: 'var(--bg-input)',
                                        color: 'var(--text-primary)'
                                    }}
                                    placeholder="#3b82f6"
                                />
                            </div>
                        </div>
                        <div 
                            className="w-10 h-10 rounded-xl border-2 flex-shrink-0"
                            style={{ 
                                backgroundColor: localColor,
                                borderColor: 'var(--border-color)'
                            }}
                        />
                    </div>

                    {/* Color actual */}
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                        <div className="flex items-center justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
                            <span>Color actual</span>
                            <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{currentColor}</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ColorPicker;