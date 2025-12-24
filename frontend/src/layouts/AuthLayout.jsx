import ThemeToggle from "../components/ThemeToggle";

export default function AuthLayout({ children }) {
  return (
    <div className="min-h-screen w-full bg-gradient-to-br from-gray-100 via-gray-200 to-gray-300
                    dark:from-gray-950 dark:via-gray-900 dark:to-gray-800">
      <ThemeToggle />
      <div className="mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}
