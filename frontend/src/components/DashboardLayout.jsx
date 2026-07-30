// frontend/src/components/DashboardLayout.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import ThemeToggle from './ThemeToggle';
import ColorPicker from './ui/ColorPicker';
import NotificacionesCampana from './ui/NotificacionesCampana';
import IAChat from './ui/IAChat';
import { Calendar, Sparkles } from 'lucide-react';

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
  Truck
} from 'lucide-react';

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [showIAChat, setShowIAChat] = useState(false);
  const { user, logout } = useAuth();
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

  const navigation = useMemo(() => {
    const commonNav = [
      { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { name: 'Servicios', href: '/dashboard/servicios', icon: Wrench },
      { name: 'Clientes', href: '/dashboard/clientes', icon: Users },
      { name: 'Inventarios', href: '/dashboard/inventarios', icon: Package },
      { name: 'Tipos de Servicio', href: '/dashboard/tipos-servicio', icon: FileText },
      { name: 'Reportes', href: '/dashboard/reportes', icon: BarChart3 },
      { name: 'Agenda', href: '/dashboard/agenda', icon: Calendar },
      { name: 'Facturas', href: '/dashboard/facturas', icon: FileText },
      { name: 'Alquileres', href: '/dashboard/alquileres', icon: Truck },
    ];

    if (user?.rol === 'admin') {
      return [
        ...commonNav,
        { name: 'Técnicos', href: '/dashboard/tecnicos', icon: UserCheck },
        { name: 'Usuarios', href: '/dashboard/usuarios', icon: UserCog },
      ];
    }

    return commonNav;
  }, [user?.rol]);

  const isActive = (href) => location.pathname === href;

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const displayName = user?.nombre1 || user?.usuario || user?.email || 'Usuario';
  const roleName = user?.rol === 'admin' ? 'Administrador' : user?.rol === 'tecnico' ? 'Técnico' : 'Usuario';

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
              <User className="w-5 h-5" style={{ color: 'var(--text-muted)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{displayName}</p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{roleName}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors"
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