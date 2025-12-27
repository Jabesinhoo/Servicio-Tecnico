import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useEffect, useRef, useState } from "react";

export default function Login() {
  useDocumentTitle("Sistema Técnicos | Iniciar sesión");
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const passwordRef = useRef(null);

  const [loading, setLoading] = useState(false);

  // ✅ Mensajes
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Auto-ocultar mensajes (opcional)
  useEffect(() => {
    if (!error && !success) return;
    const t = setTimeout(() => {
      setError("");
      setSuccess("");
    }, 4000);
    return () => clearTimeout(t);
  }, [error, success]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const password = passwordRef.current?.value || "";

    if (!identifier.trim() || !password) {
      setError("Completa usuario/correo y contraseña.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Si luego migras a cookie httpOnly: agrega -> credentials: "include",
        body: JSON.stringify({ identifier, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "Credenciales inválidas.");
        return;
      }

      // Si usas token en JSON:
      if (data?.token) localStorage.setItem("token", data.token);
      if (data?.user) localStorage.setItem("user", JSON.stringify(data.user));

      setSuccess("Sesión iniciada correctamente. Redirigiendo...");

      if (passwordRef.current) passwordRef.current.value = "";

      setTimeout(() => navigate("/dashboard"), 700);
    } catch {
      setError("Error de red o backend apagado.");
    } finally {
      setLoading(false);
      if (passwordRef.current) passwordRef.current.value = "";
    }
  };

  return (
    <AuthCard title="Iniciar sesión" subtitle="Ingresa con tu nombre de usuario o tu correo">
      {/* ✅ Mensajes */}
      {(error || success) && (
        <div className="mb-4 space-y-2">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
              {error}
            </div>
          )}
          {success && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
              {success}
            </div>
          )}
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-4">
        <input
          className="input"
          placeholder="Usuario o correo"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          autoComplete="username"
        />

        <input
          ref={passwordRef}
          className="input"
          type="password"
          placeholder="Contraseña"
          autoComplete="current-password"
        />

        <button
          disabled={loading}
          className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="text-center text-sm text-gray-600 dark:text-gray-300">
          ¿No tienes cuenta?{" "}
          <Link className="font-semibold text-blue-600 hover:underline" to="/register">
            Regístrate
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}
