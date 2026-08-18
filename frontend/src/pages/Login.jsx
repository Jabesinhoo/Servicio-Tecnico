import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { publicApi } from "../services/api";
import {
  Lock,
  User,
  LogIn,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";

export default function Login() {
  useDocumentTitle("Sistema Técnicos | Iniciar sesión");

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!error && !success) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [error, success]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError("");
    setSuccess("");

    const normalizedIdentifier = identifier.trim();

    if (!normalizedIdentifier || !password) {
      setError("Por favor, completa todos los campos.");
      return;
    }

    setLoading(true);

    try {
      console.log("LOGIN DEBUG:", {
        identifier: normalizedIdentifier,
        passwordLength: password.length,
      });
      const response = await publicApi.post("/api/auth/login", {
        identifier: normalizedIdentifier,
        password,
      });

      const data = response.data;

      if (!data?.token || !data?.user) {
        throw new Error(
          "El servidor no devolvió una sesión válida."
        );
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      setSuccess(
        "¡Inicio de sesión exitoso! Redirigiendo..."
      );

      // Recargar la aplicación para que AuthContext
      // inicialice inmediatamente la sesión recién creada.
      window.location.replace("/dashboard");
    } catch (requestError) {
      console.error(
        "Error iniciando sesión:",
        requestError
      );

      const message =
        requestError.response?.data?.message ||
        requestError.message ||
        "No se pudo conectar con el servidor.";

      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[92vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        {/* Header del sistema */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-sky-600 to-indigo-600 rounded-2xl shadow-lg mb-4">
            <ShieldCheck className="w-9 h-9 text-white" />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Sistema Técnicos
          </h1>
        </div>

        {/* Tarjeta de login */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {/* Barra superior */}
          <div className="h-1 bg-gradient-to-r from-sky-500 via-indigo-500 to-purple-500" />

          <div className="p-5 sm:p-8">
            {/* Encabezado del formulario */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 bg-sky-100 dark:bg-sky-900/30 rounded-full mb-4">
                <LogIn className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>

              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">
                Iniciar sesión
              </h2>
            </div>

            {/* Mensajes */}
            {(error || success) && (
              <div
                className={`mb-6 p-4 rounded-xl border animate-fadeIn ${error
                  ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                  : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                  }`}
              >
                <div className="flex items-center gap-3">
                  {error ? (
                    <>
                      <svg
                        className="w-5 h-5 text-red-500 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                          clipRule="evenodd"
                        />
                      </svg>

                      <span className="text-red-700 dark:text-red-300 font-medium">
                        {error}
                      </span>
                    </>
                  ) : (
                    <>
                      <svg
                        className="w-5 h-5 text-emerald-600 shrink-0"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                        aria-hidden="true"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                          clipRule="evenodd"
                        />
                      </svg>

                      <span className="text-emerald-700 dark:text-emerald-300 font-medium">
                        {success}
                      </span>
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Formulario */}
            <form
              onSubmit={handleSubmit}
              className="responsive-page min-w-0 space-y-4 sm:space-y-6"
            >
              <div className="space-y-5 min-w-0">
                {/* Usuario o correo */}
                <div className="min-w-0 flex flex-col gap-2">
                  <label
                    htmlFor="identifier"
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Usuario o correo electrónico
                  </label>

                  <div className="relative min-w-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>

                    <input
                      id="identifier"
                      name="identifier"
                      type="text"
                      value={identifier}
                      onChange={(event) =>
                        setIdentifier(event.target.value)
                      }
                      className="
                        w-full max-w-full box-border h-12
                        pl-10 pr-4
                        rounded-xl
                        border border-slate-300 dark:border-slate-700
                        bg-white dark:bg-slate-900
                        text-slate-900 dark:text-slate-100
                        placeholder:text-slate-400
                        outline-none
                        focus-visible:ring-2 focus-visible:ring-sky-500
                        focus-visible:border-sky-500
                        transition
                      "
                      placeholder="Usuario o correo electrónico"
                      autoComplete="username"
                      disabled={loading}
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="min-w-0 flex flex-col gap-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-semibold text-slate-700 dark:text-slate-200"
                  >
                    Contraseña
                  </label>

                  <div className="relative min-w-0">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Lock className="h-5 w-5 text-slate-400" />
                    </div>

                    <input
                      id="password"
                      name="password"
                      type={
                        showPassword
                          ? "text"
                          : "password"
                      }
                      value={password}
                      onChange={(event) =>
                        setPassword(event.target.value)
                      }
                      className="
                        w-full max-w-full box-border h-12
                        pl-10 pr-12
                        rounded-xl
                        border border-slate-300 dark:border-slate-700
                        bg-white dark:bg-slate-900
                        text-slate-900 dark:text-slate-100
                        placeholder:text-slate-400
                        outline-none
                        focus-visible:ring-2 focus-visible:ring-sky-500
                        focus-visible:border-sky-500
                        transition
                      "
                      placeholder="••••••••"
                      autoComplete="current-password"
                      disabled={loading}
                    />

                    <button
                      type="button"
                      onClick={() =>
                        setShowPassword(
                          (currentValue) =>
                            !currentValue
                        )
                      }
                      className="
                        absolute inset-y-0 right-0
                        w-12 flex items-center justify-center
                        bg-transparent
                        text-slate-400 hover:text-slate-600
                        dark:hover:text-slate-200
                        outline-none border-0
                      "
                      aria-label={
                        showPassword
                          ? "Ocultar contraseña"
                          : "Mostrar contraseña"
                      }
                      disabled={loading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Botón */}
              <button
                type="submit"
                disabled={loading}
                className="
                  w-full h-12 rounded-xl font-bold
                  bg-gradient-to-r from-sky-600 to-indigo-600
                  hover:from-sky-700 hover:to-indigo-700
                  text-white shadow-lg hover:shadow-xl
                  transition-all duration-300
                  disabled:opacity-70 disabled:cursor-not-allowed
                  flex items-center justify-center gap-2
                "
              >
                {loading ? (
                  <>
                    <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />

                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>

                    Iniciando sesión...
                  </>
                ) : (
                  <>
                    <LogIn className="w-5 h-5" />
                    Inicia sesión
                  </>
                )}
              </button>

              {/* Registro */}
              <div className="pt-6 border-t border-slate-200 dark:border-slate-800">
                <p className="text-center text-slate-600 dark:text-slate-400">
                  ¿No tienes una cuenta?{" "}
                  <Link
                    to="/register"
                    className="font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition"
                  >
                    Crear cuenta
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-slate-500 dark:text-slate-400 text-sm">
          <p>
            © {new Date().getFullYear()} Sistema
            Técnicos. @Jabesinho Todos los derechos
            reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
