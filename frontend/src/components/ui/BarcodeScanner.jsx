// frontend/src/components/ui/BarcodeScanner.jsx
import React, { useState, useRef, useEffect } from 'react';
import { Barcode, Camera, X, Check, AlertCircle, Loader2 } from 'lucide-react';

const BarcodeScanner = ({ 
    onScan, 
    onClose, 
    title = 'Escanear Codigo de Barras',
    placeholder = 'Escanee o escriba el codigo...',
    productos = [],
    seriales = []
}) => {
    const [inputValue, setInputValue] = useState('');
    const [scannedItems, setScannedItems] = useState([]);
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(null);
    const inputRef = useRef(null);
    const timeoutRef = useRef(null);

    // Auto-focus al input
    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    // Manejar escaneo manual o por teclado
    const handleScan = () => {
        if (!inputValue.trim()) {
            setError('Ingrese un codigo');
            return;
        }

        setScanning(true);
        setError(null);
        setSuccess(null);

        // Buscar si el codigo es un SKU o serial
        const producto = productos.find(p => p.codigo === inputValue.trim());
        const serial = seriales.find(s => s.serial === inputValue.trim());

        // Limpiar timeout anterior
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }

        // Simular proceso de escaneo
        timeoutRef.current = setTimeout(() => {
            if (producto) {
                const item = {
                    codigo: producto.codigo,
                    nombre: producto.nombre,
                    tipo: 'producto',
                    timestamp: new Date().toISOString()
                };
                setScannedItems([...scannedItems, item]);
                setSuccess(`Producto escaneado: ${producto.nombre}`);
                onScan && onScan(item);
                setInputValue('');
                setScanning(false);
            } else if (serial) {
                const item = {
                    serial: serial.serial,
                    producto_id: serial.id_producto_externo,
                    tipo: 'serial',
                    timestamp: new Date().toISOString()
                };
                setScannedItems([...scannedItems, item]);
                setSuccess(`Serial escaneado: ${serial.serial}`);
                onScan && onScan(item);
                setInputValue('');
                setScanning(false);
            } else {
                setError(`Producto o serial no encontrado: ${inputValue}`);
                setScanning(false);
            }
        }, 500);
    };

    // Manejar tecla Enter
    const handleKeyPress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleScan();
        }
    };

    // Limpiar timeout al desmontar
    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const removeItem = (index) => {
        const newItems = [...scannedItems];
        newItems.splice(index, 1);
        setScannedItems(newItems);
    };

    const clearAll = () => {
        setScannedItems([]);
        setInputValue('');
        setError(null);
        setSuccess(null);
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Barcode className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {/* Input de escaneo */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Escanear o escribir codigo
                        </label>
                        <div className="flex gap-2">
                            <div className="relative flex-1">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Camera className="w-4 h-4 text-gray-400" />
                                </div>
                                <input
                                    ref={inputRef}
                                    type="text"
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder={placeholder}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                    autoFocus
                                />
                            </div>
                            <button
                                onClick={handleScan}
                                disabled={scanning}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
                            >
                                {scanning ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Barcode className="w-4 h-4" />
                                )}
                                Escanear
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500">
                            Use un lector USB o escriba el codigo manualmente
                        </p>
                    </div>

                    {/* Mensajes */}
                    {error && (
                        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-2 text-red-700 dark:text-red-300">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    {success && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg flex items-center gap-2 text-green-700 dark:text-green-300">
                            <Check className="w-4 h-4" />
                            {success}
                        </div>
                    )}

                    {/* Items escaneados */}
                    {scannedItems.length > 0 && (
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                    Items escaneados ({scannedItems.length})
                                </h4>
                                <button
                                    onClick={clearAll}
                                    className="text-xs text-red-500 hover:text-red-700"
                                >
                                    Limpiar todos
                                </button>
                            </div>
                            <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-48 overflow-y-auto">
                                {scannedItems.map((item, index) => (
                                    <div
                                        key={index}
                                        className="flex items-center justify-between px-4 py-2 border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    >
                                        <div>
                                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                                {item.nombre || item.serial || item.codigo}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {item.tipo === 'producto' ? 'Producto' : 'Serial'} - {new Date(item.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={() => removeItem(index)}
                                            className="text-red-500 hover:text-red-700"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Botones de accion */}
                    <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-800">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700"
                        >
                            Cerrar
                        </button>
                        {scannedItems.length > 0 && (
                            <button
                                onClick={() => {
                                    onScan && onScan(scannedItems);
                                    onClose();
                                }}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
                            >
                                <Check className="w-4 h-4" />
                                Confirmar ({scannedItems.length})
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default BarcodeScanner;