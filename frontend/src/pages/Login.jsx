import { Link } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import AuthCard from "../components/AuthCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useState } from "react";

export default function Login() {
  useDocumentTitle("Sistema Técnicos | Iniciar sesión");

  const [identifier, setIdentifier] = useState(""); // nombre o correo
  const [password, setPassword] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    // Luego: POST /api/auth/login con { identifier, password }
    console.log({ identifier, password });
  };

  return (
    <AuthLayout>
      <AuthCard
        title="Iniciar sesión"
        subtitle="Ingresa con tu nombre de usuario o tu correo"
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <input
            className="input"
            placeholder="Nombre o correo"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
          />
          <input
            className="input"
            type="password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          <button className="w-full rounded-lg bg-blue-600 py-2 font-semibold text-white hover:bg-blue-700">
            Entrar
          </button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-300">
            ¿No tienes cuenta?{" "}
            <Link className="font-semibold text-blue-600 hover:underline" to="/registro">
              Regístrate
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
