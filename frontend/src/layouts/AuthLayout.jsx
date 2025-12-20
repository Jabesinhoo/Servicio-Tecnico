import ThemeToggle from "../components/ThemeToggle";
import { Cog, Wrench, Hammer } from "lucide-react";

export default function AuthLayout({ children }) {
  return (
    <div
      className="min-h-screen relative overflow-hidden flex items-center justify-center
                 bg-gradient-to-br from-gray-100 to-gray-300
                 dark:from-gray-950 dark:to-gray-800"
    >
      <ThemeToggle />

      {/* Decoración */}
      <div className="pointer-events-none absolute inset-0 opacity-20 dark:opacity-25">
        <Cog className="absolute -left-10 -top-10 h-56 w-56 rotate-12" />
        <Cog className="absolute right-10 top-16 h-40 w-40 -rotate-12" />
        <Wrench className="absolute left-16 bottom-16 h-44 w-44 rotate-6" />
        <Hammer className="absolute right-16 bottom-10 h-44 w-44 -rotate-6" />
      </div>

      {/* Contenido */}
      <div className="relative z-10 w-full px-4">{children}</div>
    </div>
  );
}
