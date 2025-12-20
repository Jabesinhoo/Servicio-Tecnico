import logo from "../assets/img/logo.png";

export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border border-gray-200 bg-white/90 p-8 shadow-2xl
                    dark:border-gray-800 dark:bg-gray-950/80">
      <img src={logo} alt="Logo" className="mx-auto mb-4 h-16 w-16 object-contain" />
      <h1 className="text-center text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h1>
      {subtitle && (
        <p className="mt-1 text-center text-sm text-gray-600 dark:text-gray-300">{subtitle}</p>
      )}
      <div className="mt-6">{children}</div>
    </div>
  );
}
