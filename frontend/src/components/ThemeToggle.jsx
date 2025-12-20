import { useTheme } from "../context/ThemeContext";

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="absolute right-4 top-4 rounded-lg border border-gray-300 bg-white/80 px-3 py-2 text-sm
                 hover:bg-white dark:border-gray-700 dark:bg-gray-900/80 dark:text-gray-100"
      aria-label="Cambiar tema"
      type="button"
    >
      {theme === "dark" ? " Claro" : " Oscuro"}
    </button>
  );
}
