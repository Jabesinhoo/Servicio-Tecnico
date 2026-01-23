import { Outlet } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";
import { Cog, Wrench, Hammer, Shield } from "lucide-react";

export default function AuthLayout() {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center p-4 overflow-hidden">
      <ThemeToggle />
      
      {/* Elementos decorativos técnicos */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Iconos técnicos flotantes */}
        <div className="absolute top-10 left-10 animate-float-slow">
          <Cog className="w-12 h-12 text-blue-400/30 dark:text-blue-500/20" />
        </div>
        <div className="absolute top-20 right-20 animate-float">
          <Wrench className="w-10 h-10 text-indigo-400/30 dark:text-indigo-500/20" />
        </div>
        <div className="absolute bottom-20 left-20 animate-float-slower">
          <Hammer className="w-14 h-14 text-cyan-400/30 dark:text-cyan-500/20" />
        </div>
        <div className="absolute bottom-10 right-10 animate-float">
          <Shield className="w-16 h-16 text-blue-500/20 dark:text-blue-600/20" />
        </div>
        
        {/* Gradientes decorativos */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/20 dark:bg-blue-900/10 rounded-full blur-3xl"></div>
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200/20 dark:bg-indigo-900/10 rounded-full blur-3xl"></div>
      </div>
      
      {/* Contenido principal */}
      <div className="relative z-10 w-full max-w-7xl">
        <Outlet />
      </div>
    </div>
  );
}