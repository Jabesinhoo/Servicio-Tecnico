import { Link, useNavigate } from "react-router-dom";
import { useMemo, useState } from "react";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { User, Mail, Phone, Key, UserPlus, Eye, EyeOff, IdCard } from "lucide-react";

/* ✅ COMPONENTES FUERA (para que NO se remonten y no se pierda el foco) */
function InputField({
  label,
  name,
  icon: Icon,
  type = "text",
  placeholder,
  optional = false,
  autoComplete = "off",
  value,
  onChange,
}) {
  return (
    <div className="min-w-0 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          {label}
        </label>

        {/* mantiene altura uniforme */}
        <span
          className={`text-xs text-slate-500 dark:text-slate-400 ${
            optional ? "" : "opacity-0"
          }`}
        >
          Opcional
        </span>
      </div>

      <div className="relative min-w-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Icon className="h-5 w-5 text-slate-400" />
        </div>

        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="
            w-full max-w-full box-border h-12
            pl-10 pr-4
            rounded-xl
            border border-slate-300 dark:border-slate-700
            bg-white dark:bg-slate-900
            text-slate-900 dark:text-slate-100
            placeholder:text-slate-400
            outline-none
            focus-visible:ring-2 focus-visible:ring-emerald-500
            focus-visible:border-emerald-500
            transition
          "
        />
      </div>
    </div>
  );
}

function PasswordField({
  label,
  name,
  placeholder,
  value,
  onChange,
  show,
  setShow,
}) {
  return (
    <div className="min-w-0 flex flex-col gap-2">
      <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
        {label}
      </label>

      <div className="relative min-w-0">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Key className="h-5 w-5 text-slate-400" />
        </div>

        <input
          type={show ? "text" : "password"}
          name={name}
          value={value}
          onChange={onChange}
          autoComplete="new-password"
          placeholder={placeholder}
          className="
            w-full max-w-full box-border h-12
            pl-10 pr-12
            rounded-xl
            border border-slate-300 dark:border-slate-700
            bg-white dark:bg-slate-900
            text-slate-900 dark:text-slate-100
            placeholder:text-slate-400
            outline-none
            focus-visible:ring-2 focus-visible:ring-emerald-500
            focus-visible:border-emerald-500
            transition
          "
        />

        {/* ✅ Ojo sin cuadro blanco */}
        <button
          type="button"
          onClick={() => setShow(!show)}
          className="
            absolute inset-y-0 right-0
            w-12 flex items-center justify-center
            bg-transparent
            text-slate-400 hover:text-slate-600
            dark:hover:text-slate-200
            outline-none border-0
          "
          aria-label="Mostrar/Ocultar contraseña"
        >
          {show ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );
}

export default function Register() {
  useDocumentTitle("Sistema Técnicos | Registro");
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    nombre1: "",
    nombre2: "",
    apellidos: "",
    usuario: "",
    cedula: "",
    email: "",
    celular: "",
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const canSubmit = useMemo(() => {
    return (
      formData.nombre1.trim() &&
      formData.apellidos.trim() &&
      formData.usuario.trim() &&
      formData.cedula.trim() &&
      formData.email.trim() &&
      formData.password.length >= 6 &&
      formData.password === formData.confirmPassword
    );
  }, [formData]);

  const handleSubmit = async (e) => {
  e.preventDefault();
  setError("");
  setSuccess("");

  if (formData.password.length < 6) {
    setError("La contraseña debe tener mínimo 6 caracteres.");
    return;
  }
  if (formData.password !== formData.confirmPassword) {
    setError("Las contraseñas no coinciden.");
    return;
  }

  setLoading(true);
  try {
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre1: formData.nombre1,
        nombre2: formData.nombre2,
        apellidos: formData.apellidos,
        usuario: formData.usuario,
        cedula: formData.cedula,
        email: formData.email,
        celular: formData.celular,
        password: formData.password,
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.message || "Error al registrar.");
      return;
    }

    setSuccess("¡Registro exitoso! Redirigiendo al login...");
    navigate("/login");
  } catch {
    setError("No se pudo conectar con el servidor.");
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="min-h-[92vh] flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-5xl">
        {/* HEADER */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-r from-emerald-600 to-green-600 shadow-lg mb-4">
            <UserPlus className="w-9 h-9 text-white" />
          </div>

          <h1 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            Registro Técnico
          </h1>

          <p className="mt-2 text-base text-slate-600 dark:text-slate-300">
            Crea tu cuenta para acceder al sistema 
          </p>
        </div>

        {/* CARD (overflow-hidden evita que el ring se “salga”) */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          <div className="h-1 bg-gradient-to-r from-emerald-500 via-green-500 to-teal-500" />

          <div className="p-8 md:p-10">
            {/* FORM HEADER */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/30 mb-4">
                <UserPlus className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>

              <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                Crear tu cuenta 
              </h2>
            </div>

            {/* ALERTS */}
            {(error || success) && (
              <div
                className={`mb-8 p-4 rounded-xl border animate-fadeIn ${
                  error
                    ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                    : "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800"
                }`}
              >
                <span
                  className={`font-medium ${
                    error
                      ? "text-red-700 dark:text-red-300"
                      : "text-emerald-700 dark:text-emerald-300"
                  }`}
                >
                  {error || success}
                </span>
              </div>
            )}

            {/* ✅ FORM UN SOLO BLOQUE (IZQ/DER alternando) */}
            <form onSubmit={handleSubmit} className="space-y-10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-7 min-w-0">
                {/* 1 Izq */}
                <InputField
                  label="Primer Nombre *"
                  name="nombre1"
                  icon={User}
                  placeholder="Ingrese su primer nombre"
                  autoComplete="given-name"
                  value={formData.nombre1}
                  onChange={handleChange}
                />

                {/* 1 Der */}
                <InputField
                  label="Usuario *"
                  name="usuario"
                  icon={User}
                  placeholder="Crea un nombre de usuario"
                  autoComplete="username"
                  value={formData.usuario}
                  onChange={handleChange}
                />

                {/* 2 Izq */}
                <InputField
                  label="Segundo Nombre"
                  name="nombre2"
                  icon={User}
                  placeholder="Ingrese su segundo nombre"
                  optional
                  autoComplete="additional-name"
                  value={formData.nombre2}
                  onChange={handleChange}
                />

                {/* 2 Der */}
                <InputField
                  label="Correo Electrónico *"
                  name="email"
                  icon={Mail}
                  type="email"
                  placeholder="ejemplo@dominio.com"
                  autoComplete="email"
                  value={formData.email}
                  onChange={handleChange}
                />

                {/* 3 Izq */}
                <InputField
                  label="Apellidos *"
                  name="apellidos"
                  icon={User}
                  placeholder="Ingrese sus apellidos"
                  autoComplete="family-name"
                  value={formData.apellidos}
                  onChange={handleChange}
                />

                {/* 3 Der */}
                <InputField
                  label="Celular"
                  name="celular"
                  icon={Phone}
                  placeholder="Número de celular"
                  optional
                  autoComplete="tel"
                  value={formData.celular}
                  onChange={handleChange}
                />

                {/* 4 Izq */}
                <InputField
                  label="Cédula *"
                  name="cedula"
                  icon={IdCard}
                  placeholder="Número de cédula"
                  value={formData.cedula}
                  onChange={handleChange}
                />

                {/* 4 Der */}
                <PasswordField
                  label="Contraseña *"
                  name="password"
                  placeholder="Crea una contraseña segura"
                  value={formData.password}
                  onChange={handleChange}
                  show={showPassword}
                  setShow={setShowPassword}
                />

                {/* 5 Izq */}
                <PasswordField
                  label="Confirmar Contraseña *"
                  name="confirmPassword"
                  placeholder="Repite tu contraseña"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  show={showConfirm}
                  setShow={setShowConfirm}
                />

                {/* 5 Der: relleno estético */}
                <div className="hidden md:block" />
              </div>

              {/* BOTÓN */}
              <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-6">
                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className={`
                    w-full h-12 rounded-xl font-bold
                    flex items-center justify-center gap-2
                    transition-all duration-300
                    ${
                      canSubmit
                        ? "bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-700 hover:to-green-700 text-white shadow-lg hover:shadow-xl"
                        : "bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                    }
                  `}
                >
                  {loading ? "Creando cuenta..." : "Registrarse en el Sistema"}
                </button>

                <p className="text-center text-slate-600 dark:text-slate-400">
                  ¿Ya tienes una cuenta?{" "}
                  <Link
                    to="/login"
                    className="font-bold text-sky-600 hover:text-sky-700 dark:text-sky-400 dark:hover:text-sky-300 transition"
                  >
                    Iniciar sesión
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>

        {/* FOOTER */}
        <div className="mt-8 text-center text-slate-500 dark:text-slate-400 text-sm">
           <p>
            © {new Date().getFullYear()} Sistema Técnicos. @Jabesinho
             Todos los derechos reservados.
          </p>
        </div>
      </div>
    </div>
  );
}
