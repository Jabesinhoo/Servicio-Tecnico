import { Link, useNavigate } from "react-router-dom";
import { useMemo, useRef, useState } from "react";
import AuthLayout from "../layouts/AuthLayout";
import AuthCard from "../components/AuthCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

export default function Register() {
  useDocumentTitle("Sistema Técnicos | Registro");
  const navigate = useNavigate();

  const [nombre1, setNombre1] = useState("");
  const [nombre2, setNombre2] = useState("");
  const [apellidos, setApellidos] = useState("");

  const [usuario, setUsuario] = useState("");
  const [cedula, setCedula] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");

  // ✅ passwords en refs (no state)
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);

  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState("");

  const inputClass =
    "w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm outline-none " +
    "focus:ring-2 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100";

  const labelClass = "text-xs font-semibold text-gray-700 dark:text-gray-200";

  const canSubmit = useMemo(() => {
    const p = passwordRef.current?.value || "";
    const c = confirmRef.current?.value || "";
    return (
      nombre1.trim() &&
      apellidos.trim() &&
      usuario.trim() &&
      cedula.trim() &&
      email.trim() &&
      p.length >= 6 &&
      p === c
    );
  }, [nombre1, apellidos, usuario, cedula, email]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setOk("");

    const password = passwordRef.current?.value || "";
    const confirmPassword = confirmRef.current?.value || "";

    if (password.length < 6) {
      setError("La contraseña debe tener mínimo 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLoading(true);

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre1: nombre1.trim(),
          nombre2: nombre2.trim() ? nombre2.trim() : null,
          apellidos: apellidos.trim(),
          usuario: usuario.trim(),
          cedula: cedula.trim(),
          email: email.trim().toLowerCase(),
          celular: celular.trim() ? celular.trim() : null,
          password,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.message || "No se pudo registrar. Revisa los datos.");
        return;
      }

      setOk("Registro exitoso. Redirigiendo...");
      setTimeout(() => navigate("/inicio"), 700);
    } catch {
      setError("Error de red o backend apagado.");
    } finally {
      setLoading(false);

      // ✅ limpia inputs de contraseña
      if (passwordRef.current) passwordRef.current.value = "";
      if (confirmRef.current) confirmRef.current.value = "";
      setShowPass(false);
      setShowConfirm(false);
    }
  };

  return (
    <AuthLayout>
      <AuthCard title="Registro" subtitle="Crea tu cuenta">
        {(error || ok) && (
          <div className="mb-4">
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-200">
                {error}
              </div>
            )}
            {ok && (
              <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700 dark:border-green-900/40 dark:bg-green-950/30 dark:text-green-200">
                {ok}
              </div>
            )}
          </div>
        )}

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className={labelClass}>Primer nombre</label>
            <input className={inputClass} value={nombre1} onChange={(e) => setNombre1(e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Segundo nombre (opcional)</label>
            <input className={inputClass} value={nombre2} onChange={(e) => setNombre2(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Apellidos</label>
            <input className={inputClass} value={apellidos} onChange={(e) => setApellidos(e.target.value)} />
          </div>

          <div>
            <label className={labelClass}>Usuario</label>
            <input className={inputClass} value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" />
          </div>

          <div>
            <label className={labelClass}>Cédula</label>
            <input className={inputClass} value={cedula} onChange={(e) => setCedula(e.target.value)} />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Correo</label>
            <input className={inputClass} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          </div>

          <div className="md:col-span-2">
            <label className={labelClass}>Celular</label>
            <input className={inputClass} value={celular} onChange={(e) => setCelular(e.target.value)} />
          </div>

          {/* ✅ Password uncontrolled */}
          <div>
            <label className={labelClass}>Contraseña</label>
            <div className="relative">
              <input
                ref={passwordRef}
                className={`${inputClass} pr-16`}
                type={showPass ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Contraseña"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-gray-100
                           dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {showPass ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {/* ✅ Confirm uncontrolled */}
          <div>
            <label className={labelClass}>Confirmar contraseña</label>
            <div className="relative">
              <input
                ref={confirmRef}
                className={`${inputClass} pr-16`}
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                placeholder="Confirmar"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg px-2 py-1 text-xs text-gray-600 hover:bg-gray-100
                           dark:text-gray-300 dark:hover:bg-gray-800"
              >
                {showConfirm ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <button
              disabled={loading}
              className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-semibold text-white hover:bg-green-700
                         disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Registrando..." : "Registrarse"}
            </button>

            <p className="mt-3 text-center text-sm text-gray-600 dark:text-gray-300">
              ¿Ya tienes cuenta?{" "}
              <Link className="font-semibold text-blue-600 hover:underline" to="/inicio">
                Inicia sesión
              </Link>
            </p>
          </div>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
