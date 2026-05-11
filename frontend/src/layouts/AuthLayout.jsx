// src/layouts/AuthLayout.jsx
import { Outlet } from "react-router-dom";
import ThemeToggle from "../components/ThemeToggle";

export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-4 relative">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-7xl">
        <Outlet />
      </div>
    </div>
  );
}