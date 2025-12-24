import { Navigate, Route, Routes } from "react-router-dom";
import Login from "../../../frontend/src/pages/Login.jsx";
import Register from "../../../frontend/src/pages/Register.jsx";

export default function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/inicio" replace />} />
      <Route path="/inicio" element={<Login />} />
      <Route path="/registro" element={<Register />} />
      <Route path="*" element={<Navigate to="/inicio" replace />} />
    </Routes>
  );
}
