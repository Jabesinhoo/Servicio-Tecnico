// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import DashboardLayout from './components/DashboardLayout';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';

// Dashboard Pages
import Dashboard from './pages/Dashboard/Dashboard';

// Servicios - verificar si existe pages/Servicios.jsx o pages/Servicios/Servicios.jsx
let Servicios, Inventarios, Ventas, Clientes, Tecnicos, Usuarios, TiposServicio, Agenda, Facturas, Alquileres, Reportes;

try {
  Servicios = require('./pages/Servicios/Servicios').default;
} catch {
  try {
    Servicios = require('./pages/Servicios').default;
  } catch {
    Servicios = () => <div className="p-6"><h1 className="text-2xl font-bold">Servicios</h1></div>;
  }
}

try {
  Inventarios = require('./pages/Inventarios/Inventarios').default;
} catch {
  try {
    Inventarios = require('./pages/Inventarios').default;
  } catch {
    Inventarios = () => <div className="p-6"><h1 className="text-2xl font-bold">Inventarios</h1></div>;
  }
}

try {
  Ventas = require('./pages/Ventas/Ventas').default;
} catch {
  try {
    Ventas = require('./pages/Ventas').default;
  } catch {
    Ventas = () => <div className="p-6"><h1 className="text-2xl font-bold">Ventas</h1></div>;
  }
}

// Dashboard pages - verificar si existen
try {
  Clientes = require('./pages/Dashboard/Clientes').default;
} catch {
  Clientes = () => <div className="p-6"><h1 className="text-2xl font-bold">Clientes</h1></div>;
}

try {
  Tecnicos = require('./pages/Dashboard/Tecnicos').default;
} catch {
  Tecnicos = () => <div className="p-6"><h1 className="text-2xl font-bold">Técnicos</h1></div>;
}

try {
  Usuarios = require('./pages/Dashboard/Usuarios').default;
} catch {
  Usuarios = () => <div className="p-6"><h1 className="text-2xl font-bold">Usuarios</h1></div>;
}

try {
  TiposServicio = require('./pages/Dashboard/TiposServicio').default;
} catch {
  TiposServicio = () => <div className="p-6"><h1 className="text-2xl font-bold">Tipos de Servicio</h1></div>;
}

try {
  Agenda = require('./pages/Dashboard/Agenda').default;
} catch {
  Agenda = () => <div className="p-6"><h1 className="text-2xl font-bold">Agenda</h1></div>;
}

try {
  Facturas = require('./pages/Dashboard/Facturas').default;
} catch {
  Facturas = () => <div className="p-6"><h1 className="text-2xl font-bold">Facturas</h1></div>;
}

try {
  Alquileres = require('./pages/Dashboard/Alquileres').default;
} catch {
  Alquileres = () => <div className="p-6"><h1 className="text-2xl font-bold">Alquileres</h1></div>;
}

try {
  Reportes = require('./pages/Dashboard/Reportes').default;
} catch {
  Reportes = () => <div className="p-6"><h1 className="text-2xl font-bold">Reportes</h1></div>;
}

// Roles y Permisos
import RolesManagement from './pages/RolesManagement';
import UserRolesAssignment from './pages/UserRolesAssignment';

// Error Boundary
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error en la aplicación:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#f8f9fa' }}>
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">⚠️</span>
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Algo salió mal</h2>
            <p className="text-gray-600 mb-4">
              Ha ocurrido un error inesperado. Por favor, recarga la página.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Recargar página
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            
            {/* Rutas protegidas */}
            <Route element={<PrivateRoute />}>
              <Route element={<DashboardLayout />}>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/dashboard/servicios" element={<Servicios />} />
                <Route path="/dashboard/inventarios" element={<Inventarios />} />
                <Route path="/dashboard/ventas" element={<Ventas />} />
                <Route path="/dashboard/clientes" element={<Clientes />} />
                <Route path="/dashboard/tecnicos" element={<Tecnicos />} />
                <Route path="/dashboard/usuarios" element={<Usuarios />} />
                <Route path="/dashboard/tipos-servicio" element={<TiposServicio />} />
                <Route path="/dashboard/agenda" element={<Agenda />} />
                <Route path="/dashboard/facturas" element={<Facturas />} />
                <Route path="/dashboard/alquileres" element={<Alquileres />} />
                <Route path="/dashboard/reportes" element={<Reportes />} />
                
                {/* Roles y Permisos */}
                <Route path="/dashboard/roles" element={<RolesManagement />} />
                <Route path="/dashboard/usuarios/roles" element={<UserRolesAssignment />} />
              </Route>
            </Route>
            
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;