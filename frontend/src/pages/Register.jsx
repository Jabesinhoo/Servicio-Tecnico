import { Link } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import AuthCard from "../components/AuthCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useState } from "react";

export default function Register() {
  useDocumentTitle("Sistema Técnicos | Registro");

  // Campos iguales a Usuario.js (rol NO se pide: queda por defecto "usuario")
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    // Luego: POST /api/auth/register con { nombre, email, celular, password }
    // rol NO se envía (o si se envía, el backend lo ignora y pone "usuario")
    console.log({ nombre, email, celular, password });
  };

  return (
    <AuthLayout>
      <AuthCard title="Registro" subtitle="Crea tu cuenta (rol por defecto: usuario)">
        <form onSubmit={onSubmit} className="space-y-4">
          <input className="input" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          <input className="input" placeholder="Correo" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input className="input" placeholder="Celular" value={celular} onChange={(e) => setCelular(e.target.value)} />
          <input className="input" type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />

          <button className="w-full rounded-lg bg-green-600 py-2 font-semibold text-white hover:bg-green-700">
            Registrarse
          </button>

          <p className="text-center text-sm text-gray-600 dark:text-gray-300">
            ¿Ya tienes cuenta?{" "}
            <Link className="font-semibold text-blue-600 hover:underline" to="/login">
              Inicia sesión
            </Link>
          </p>
        </form>
      </AuthCard>
    </AuthLayout>
  );
}
