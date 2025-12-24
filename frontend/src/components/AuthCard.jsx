import logo from "../assets/img/logo.png";

export default function AuthCard({ title, subtitle, children }) {
  return (
    <div
      className="mx-auto w-full max-w-3xl rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-2xl backdrop-blur
                 sm:p-8 dark:border-gray-800 dark:bg-gray-950/80"
    >
      <div className="flex items-center gap-4">
        <img src={logo} alt="Logo" className="h-12 w-12 object-contain" />
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
          {subtitle && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}
