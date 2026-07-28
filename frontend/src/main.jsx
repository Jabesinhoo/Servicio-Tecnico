// frontend/src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import AppRouter from './AppRouter';
import { ThemeProvider } from './context/ThemeContext';
import { NotificacionesProvider } from './context/NotificacionesContext'; // ← Agregar

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <NotificacionesProvider>  
        <AppRouter />
      </NotificacionesProvider>
    </ThemeProvider>
  </React.StrictMode>
);