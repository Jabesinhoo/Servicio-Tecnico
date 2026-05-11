// src/components/ui/Input.jsx
import React from 'react';

export const Input = ({ label, error, className = '', ...props }) => {
  return (
    <div className="w-full">
      {label && (
        <label className="input-label">
          {label}
          {props.required && <span className="text-error-500 ml-1">*</span>}
        </label>
      )}
      <input className={`input ${error ? 'border-error-500' : ''} ${className}`} {...props} />
      {error && <p className="input-error">{error}</p>}
    </div>
  );
};