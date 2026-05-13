// src/pages/Dashboard/inventarios/components/ProductImageUpload.jsx
// Actualizar la función handleFiles para comprimir imágenes

import React, { useState, useCallback } from 'react';
import { X, Upload, Image as ImageIcon, Trash2 } from 'lucide-react';

// Función para comprimir imagen
const compressImage = (file, maxWidth = 800, maxHeight = 800, quality = 0.7) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        
        // Calcular nuevas dimensiones manteniendo proporción
        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }
        if (height > maxHeight) {
          width = (width * maxHeight) / height;
          height = maxHeight;
        }
        
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          resolve({
            blob,
            name: file.name,
            type: 'image/jpeg',
            url: URL.createObjectURL(blob)
          });
        }, 'image/jpeg', quality);
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

const ProductImageUpload = ({ images = [], onChange, disabled = false }) => {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  }, []);

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleFiles(files);
  };

  const handleFiles = async (files) => {
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    setUploading(true);
    
    for (const file of imageFiles) {
      try {
        // Comprimir la imagen antes de guardar
        const compressed = await compressImage(file, 800, 800, 0.7);
        
        const newImages = [...images, {
          id: Date.now() + Math.random(),
          url: compressed.url,
          blob: compressed.blob,
          name: compressed.name,
          type: compressed.type
        }];
        onChange(newImages);
      } catch (error) {
        console.error('Error compressing image:', error);
      }
    }
    setUploading(false);
  };

  const removeImage = (index) => {
    const newImages = [...images];
    // Limpiar URL object para evitar memory leaks
    if (newImages[index].url && newImages[index].url.startsWith('blob:')) {
      URL.revokeObjectURL(newImages[index].url);
    }
    newImages.splice(index, 1);
    onChange(newImages);
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        {images.map((img, idx) => (
          <div key={img.id} className="relative group">
            <div className="w-24 h-24 rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
              <img src={img.url} alt={img.name} className="w-full h-full object-cover" />
            </div>
            <button
              type="button"
              onClick={() => removeImage(idx)}
              className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              disabled={disabled}
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        ))}
        
        {!disabled && (
          <label
            className={`w-24 h-24 rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors ${
              dragActive 
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'border-gray-300 dark:border-gray-700 hover:border-blue-400'
            } ${uploading ? 'opacity-50 cursor-wait' : ''}`}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            {uploading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-500"></div>
            ) : (
              <>
                <Upload className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-500 mt-1">Subir</span>
              </>
            )}
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}
      </div>
      <p className="text-xs text-gray-500">Arrastra o haz clic para subir imágenes (se comprimirán automáticamente)</p>
    </div>
  );
};

export default ProductImageUpload;