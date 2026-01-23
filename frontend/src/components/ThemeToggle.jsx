import { Moon, Sun } from "lucide-react";
import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className="fixed right-6 top-6 z-50 inline-flex h-12 w-12 items-center justify-center rounded-xl
                 border border-gray-200 bg-white/80 text-gray-800 backdrop-blur-md shadow-lg
                 hover:bg-white hover:scale-110 focus:outline-none focus:ring-2 focus:ring-blue-500
                 dark:border-gray-700 dark:bg-gray-800/80 dark:text-gray-100 dark:hover:bg-gray-800
                 transition-all duration-300"
      aria-label={isDark ? "Cambiar a modo claro" : "Cambiar a modo oscuro"}
      title={isDark ? "Modo claro" : "Modo oscuro"}
    >
      {isDark ? (
        <Sun className="h-6 w-6 transform transition-transform duration-300" />
      ) : (
        <Moon className="h-6 w-6 transform transition-transform duration-300" />
      )}
    </button>
  );
}