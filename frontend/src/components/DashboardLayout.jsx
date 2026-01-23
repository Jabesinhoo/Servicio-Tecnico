import React, { useMemo, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import {
  LayoutDashboard,
  ShoppingCart,
  Wrench,
  Boxes,
  FileText,
  ChevronLeft,
  Menu,
  LogOut,
  UserCircle2,
  Settings,
  Activity,
} from "lucide-react";

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const navigation = useMemo(
    () => [
      { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
      { name: "Ventas", href: "/dashboard/ventas", icon: ShoppingCart },
      { name: "Servicios", href: "/dashboard/servicios", icon: Wrench },
      { name: "Inventarios", href: "/dashboard/inventarios", icon: Boxes },
      { name: "Reportes", href: "/dashboard/reportes", icon: FileText },
    ],
    []
  );

  const userNavigation = useMemo(
    () => [
      { name: "Tu perfil", href: "/dashboard/perfil", icon: UserCircle2 },
      { name: "Configuración", href: "/dashboard/configuracion", icon: Settings },
    ],
    []
  );

  const displayName = useMemo(() => {
    return (
      `${user?.nombres || ""} ${user?.apellidos || ""}`.trim() ||
      user?.usuario ||
      user?.email ||
      "Usuario"
    );
  }, [user]);

  const roleName = useMemo(() => {
    return (user?.rol || "técnico").toString();
  }, [user]);

  const isActive = (href) => {
    // Activo exacto o ruta hija (/dashboard/ventas/...)
    return location.pathname === href || location.pathname.startsWith(href + "/");
  };

  const handleLogout = () => {
    logout?.();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Sidebar */}
      <aside
        className={`
          fixed inset-y-0 left-0 z-50 w-72
          bg-white dark:bg-slate-900
          border-r border-slate-200 dark:border-slate-800
          shadow-sm
          transform transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
      >
        {/* Brand */}
        <div className="h-16 flex items-center justify-between px-5 border-b border-slate-200 dark:border-slate-800">
          <Link to="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-r from-sky-600 to-indigo-600 flex items-center justify-center shadow-md">
              <Activity className="w-5 h-5 text-white" />
            </div>

            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                Sistema Técnicos
              </p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate">
                Panel de control
              </p>
            </div>
          </Link>

          <button
            onClick={() => setSidebarOpen(false)}
            className="
              w-10 h-10 rounded-xl
              flex items-center justify-center
              text-slate-500 hover:text-slate-700
              dark:text-slate-300 dark:hover:text-white
              hover:bg-slate-100 dark:hover:bg-slate-800
              transition
            "
            aria-label="Cerrar sidebar"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="px-4 py-5 space-y-6">
          <div>
            <p className="px-3 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Navegación
            </p>

            <div className="mt-3 space-y-1">
              {navigation.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      group flex items-center gap-3
                      px-3 py-2.5 rounded-xl
                      text-sm font-bold
                      transition
                      ${
                        active
                          ? "bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300 border border-sky-200 dark:border-sky-800"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      }
                    `}
                  >
                    <span
                      className={`
                        w-10 h-10 rounded-xl
                        flex items-center justify-center
                        transition
                        ${
                          active
                            ? "bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow-sm"
                            : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 group-hover:text-slate-700 dark:group-hover:text-white"
                        }
                      `}
                    >
                      <Icon className="w-5 h-5" />
                    </span>

                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div>
            <p className="px-3 text-xs font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Cuenta
            </p>

            <div className="mt-3 space-y-1">
              {userNavigation.map((item) => {
                const active = isActive(item.href);
                const Icon = item.icon;

                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`
                      group flex items-center gap-3
                      px-3 py-2.5 rounded-xl
                      text-sm font-bold
                      transition
                      ${
                        active
                          ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-white"
                      }
                    `}
                  >
                    <span
                      className={`
                        w-10 h-10 rounded-xl
                        flex items-center justify-center
                        bg-slate-100 dark:bg-slate-800
                        text-slate-500 dark:text-slate-300
                        group-hover:text-slate-700 dark:group-hover:text-white
                        transition
                      `}
                    >
                      <Icon className="w-5 h-5" />
                    </span>

                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center border border-slate-200 dark:border-slate-700">
              <UserCircle2 className="w-6 h-6 text-slate-500 dark:text-slate-300" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-slate-900 dark:text-white truncate">
                {displayName}
              </p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 truncate capitalize">
                {roleName}
              </p>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="
              w-full h-12 rounded-xl font-extrabold
              bg-gradient-to-r from-rose-600 to-red-600
              hover:from-rose-700 hover:to-red-700
              text-white shadow-md hover:shadow-lg
              transition-all
              flex items-center justify-center gap-2
            "
          >
            <LogOut className="w-5 h-5" />
            Salir
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div
        className={`
          transition-all duration-300
          ${sidebarOpen ? "ml-72" : "ml-0"}
        `}
      >
        {/* Top bar */}
        <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-900/80 backdrop-blur border-b border-slate-200 dark:border-slate-800">
          <div className="h-16 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
            <button
              onClick={() => setSidebarOpen((s) => !s)}
              className="
                w-11 h-11 rounded-xl
                flex items-center justify-center
                text-slate-600 hover:text-slate-900
                dark:text-slate-300 dark:hover:text-white
                hover:bg-slate-100 dark:hover:bg-slate-800
                transition
              "
              aria-label="Abrir sidebar"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
