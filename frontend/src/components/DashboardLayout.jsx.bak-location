// frontend/src/components/DashboardLayout.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from './ThemeToggle';
import ColorPicker from './ui/ColorPicker';
import NotificacionesCampana from './ui/NotificacionesCampana';
import IAChat from './ui/IAChat';

import {
  LayoutDashboard,
  Wrench,
  Package,
  BarChart3,
  Users,
  UserCog,
  UserCheck,
  FileText,
  Menu,
  LogOut,
  User,
  X,
  Truck,
  Calendar,
  Sparkles,
  Shield
} from 'lucide-react';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showIAChat, setShowIAChat] = useState(false);
  const { user, logout, canViewModule } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false);
      } else {
        setSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Navegación con permisos
  const navigation = useMemo(() => {
    const allNav = [
      { 
        name: 'Dashboard', 
        href: '/dashboard', 
        icon: LayoutDashboard,
        permission: null // visible para todos
      },
      { 
        name: 'Servicios', 
        href: '/dashboard/servicios', 
        icon: Wrench,
        permission: 'servicios'
      },
      { 
        name: 'Clientes', 
        href: '/dashboard/clientes', 
        icon: Users,
        permission: 'clientes'
      },
      { 
        name: 'Inventarios', 
        href: '/dashboard/inventarios', 
        icon: Package,
        permission: 'inventario'
      },
      { 
        name: 'Tipos de Servicio', 
        href: '/dashboard/tipos-servicio', 
        icon: FileText,
        permission: 'servicios'
      },
      { 
        name: 'Reportes', 
        href: '/dashboard/reportes', 
        icon: BarChart3,
        permission: 'reportes'
      },
      { 
        name: 'Agenda', 
        href: '/dashboard/agenda', 
        icon: Calendar,
        permission: 'agenda'
      },
      { 
        name: 'Facturas', 
        href: '/dashboard/facturas', 
        icon: FileText,
        permission: 'facturas'
      },
      { 
        name: 'Alquileres', 
        href: '/dashboard/alquileres', 
        icon: Truck,
        permission: 'alquileres'
      },
      { 
        name: 'Técnicos', 
        href: '/dashboard/tecnicos', 
        icon: UserCheck,
        permission: 'tecnicos'
      },
      { 
        name: 'Usuarios', 
        href: '/dashboard/usuarios', 
        icon: UserCog,
        permission: 'usuarios'
      },
      { 
        name: 'Roles', 
        href: '/dashboard/roles', 
        icon: Shield,
        permission: 'roles'
      },
    ];

    // Filtrar por permisos
    return allNav.filter(item => {
      if (!item.permission) return true;
      return canViewModule(item.permission);
    });
  }, [canViewModule]);

  const isActive = (href) => location.pathname === href;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Obtener nombre completo del usuario
  const getDisplayName = () => {
    if (!user) return 'Usuario';
    if (user?.nombre1 && user?.apellidos) {
      return `${user.nombre1} ${user.apellidos}`;
    }
    return user?.nombre || user?.usuario || user?.email || 'Usuario';
  };

  // Obtener rol del usuario
  const getRoleName = () => {
    if (!user) return 'Usuario';
    const role = user?.role?.name || user?.rol;
    const roleMap = {
      admin: 'Administrador',
      director_tecnico: 'Director Técnico',
      tecnico: 'Técnico',
      caja: 'Caja',
      usuario: 'Usuario'
    };
    return roleMap[role] || role || 'Usuario';
  };

  // Obtener iniciales para el avatar
  const getInitials = () => {
    const name = getDisplayName();
    if (name && name !== 'Usuario') {
      return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    }
    return (user?.email || 'U')[0].toUpperCase();
  };

  // Si el usuario no está cargado, mostrar loader
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 transition-transform duration-300 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderColor: 'var(--border-color)',
          boxShadow: 'var(--shadow-lg)'
        }}
      >
        <div className="h-16 flex items-center justify-between px-5 border-b" style={{ borderColor: 'var(--border-color)' }}>
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--color-primary)' }}>
              <span className="text-white font-bold text-sm">ST</span>
            </div>
            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Sistema Técnicos</span>
          </Link>
          {!isMobile && (
            <button
              onClick={() => setSidebarOpen(false)}
              style={{ color: 'var(--text-muted)' }}
              className="hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        <nav className="flex-1 px-3 py-6 overflow-y-auto h-[calc(100%-8rem)]">
          <div className="space-y-1">
            {navigation.map((item) => {
              const active = isActive(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  onClick={() => isMobile && setSidebarOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                    active
                      ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                  style={{
                    color: active ? 'var(--color-primary)' : 'var(--text-secondary)',
                    backgroundColor: active ? 'var(--color-primary-light)' : 'transparent'
                  }}
                >
                  <Icon className="w-5 h-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--bg-input)' }}>
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                {getInitials()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {getDisplayName()}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                {getRoleName()}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors hover:bg-red-700"
            style={{ backgroundColor: '#dc2626' }}
          >
            <LogOut className="w-4 h-4" />
            Salir
          </button>
        </div>
      </aside>

      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main content */}
      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarOpen && !isMobile ? 'ml-64' : 'ml-0'
        }`}
      >
        {/* Header */}
        <header
          className="sticky top-0 z-30 border-b shadow-sm"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderColor: 'var(--border-color)',
            boxShadow: 'var(--shadow)'
          }}
        >
          <div className="h-16 px-4 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2">
              {/* Botón IA Chat - Asistente Personal */}
              <button
                onClick={() => setShowIAChat(true)}
                className="relative p-2.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                style={{ color: 'var(--text-muted)' }}
                title="Asistente Personal IA"
              >
                <Sparkles className="w-5 h-5" />
                <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-gradient-to-r from-blue-500 to-purple-500 text-white px-1 rounded-full">
                  IA
                </span>
              </button>
              
              <NotificacionesCampana />
              <ColorPicker />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>

      {/* IA Chat Modal - Asistente Personal */}
      <IAChat isOpen={showIAChat} onClose={() => setShowIAChat(false)} />
    </div>
  );
};

export default DashboardLayout;