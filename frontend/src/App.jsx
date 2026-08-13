// frontend/src/App.jsx
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';

import { AuthProvider } from './context/AuthContext';
import { PrivateRoute } from './components/PrivateRoute';
import DashboardLayout from './components/DashboardLayout';

// ============================================================
// AUTH
// ============================================================

import Login from './pages/Login';
import Register from './pages/Register';

// ============================================================
// DASHBOARD
// ============================================================

import Dashboard from './pages/Dashboard/Dashboard';
import Servicios from './pages/Dashboard/Servicios';
import Inventarios from './pages/Dashboard/Inventarios';
import Clientes from './pages/Dashboard/Clientes';
import Tecnicos from './pages/Dashboard/Tecnicos';
import Usuarios from './pages/Dashboard/Usuarios';
import TiposServicio from './pages/Dashboard/TiposServicio';
import Agenda from './pages/Dashboard/Agenda';
import Facturas from './pages/Dashboard/Facturas';
import Alquileres from './pages/Dashboard/Alquileres';
import Reportes from './pages/Dashboard/Reportes';

// Ventas
import Ventas from './pages/Ventas/ventas';

// Roles y permisos
import RolesManagement from './pages/RolesManagement';
import UserRolesAssignment from './pages/UserRolesAssignment';

// ============================================================
// ERROR BOUNDARY
// ============================================================

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error, errorInfo) {
    console.error(
      'Error en la aplicación:',
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="min-h-screen flex items-center justify-center p-4"
          style={{
            backgroundColor: '#f8f9fa',
          }}
        >
          <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8 text-center">
            <div className="w-16 h-16 mx-auto bg-red-100 rounded-full flex items-center justify-center mb-4">
              <span className="text-3xl">
                ⚠️
              </span>
            </div>

            <h2 className="text-xl font-bold text-gray-900 mb-2">
              Algo salió mal
            </h2>

            <p className="text-gray-600 mb-4">
              Ha ocurrido un error inesperado.
              Por favor, recarga la página.
            </p>

            <button
              onClick={() =>
                window.location.reload()
              }
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

// ============================================================
// APP
// ============================================================

const App = () => {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <Routes>

            {/* ============================================== */}
            {/* RUTAS PÚBLICAS */}
            {/* ============================================== */}

            <Route
              path="/login"
              element={<Login />}
            />

            <Route
              path="/register"
              element={<Register />}
            />

            {/* ============================================== */}
            {/* RUTAS PROTEGIDAS */}
            {/* ============================================== */}

            <Route element={<PrivateRoute />}>
              <Route element={<DashboardLayout />}>

                <Route
                  path="/"
                  element={
                    <Navigate
                      to="/dashboard"
                      replace
                    />
                  }
                />

                <Route
                  path="/dashboard"
                  element={<Dashboard />}
                />

                <Route
                  path="/dashboard/servicios"
                  element={<Servicios />}
                />

                <Route
                  path="/dashboard/inventarios"
                  element={<Inventarios />}
                />

                <Route
                  path="/dashboard/ventas"
                  element={<Ventas />}
                />

                <Route
                  path="/dashboard/clientes"
                  element={<Clientes />}
                />

                <Route
                  path="/dashboard/tecnicos"
                  element={<Tecnicos />}
                />

                <Route
                  path="/dashboard/usuarios"
                  element={<Usuarios />}
                />

                <Route
                  path="/dashboard/tipos-servicio"
                  element={<TiposServicio />}
                />

                <Route
                  path="/dashboard/agenda"
                  element={<Agenda />}
                />

                <Route
                  path="/dashboard/facturas"
                  element={<Facturas />}
                />

                <Route
                  path="/dashboard/alquileres"
                  element={<Alquileres />}
                />

                <Route
                  path="/dashboard/reportes"
                  element={<Reportes />}
                />

                {/* ========================================== */}
                {/* ROLES Y PERMISOS */}
                {/* ========================================== */}

                <Route
                  path="/dashboard/roles"
                  element={<RolesManagement />}
                />

                <Route
                  path="/dashboard/usuarios/roles"
                  element={<UserRolesAssignment />}
                />

              </Route>
            </Route>

            {/* ============================================== */}
            {/* RUTA NO ENCONTRADA */}
            {/* ============================================== */}

            <Route
              path="*"
              element={
                <Navigate
                  to="/dashboard"
                  replace
                />
              }
            />

          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
};

export default App;