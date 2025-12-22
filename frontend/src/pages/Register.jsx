import { Link } from "react-router-dom";
import AuthLayout from "../layouts/AuthLayout";
import AuthCard from "../components/AuthCard";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useState } from "react";

export default function Register() {
  useDocumentTitle("Sistema Técnicos | Registro");

  const [nombre, setNombre] = useState("");
  const [usuario, setUsuario] = useState("");
  const [cedula, setCedula] = useState("");
  const [email, setEmail] = useState("");
  const [celular, setCelular] = useState("");
  const [password, setPassword] = useState("");

  const onSubmit = (e) => {
    e.preventDefault();
    // Envío al backend después:
    console.log({ nombre, usuario, cedula, email, celular, password });
  };

  return (
    <AuthLayout>
      <AuthCard title="Registro" subtitle="Crea tu cuenta">
        <form onSubmit={onSubmit} className="space-y-4">
          <input className="input" placeholder="Nombre completo" value={nombre} onChange={(e) => setNombre(e.target.value)} />

          <input className="input" placeholder="Usuario" value={usuario} onChange={(e) => setUsuario(e.target.value)} autoComplete="username" />

          <input className="input" placeholder="Cédula" value={cedula} onChange={(e) => setCedula(e.target.value)} />

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
