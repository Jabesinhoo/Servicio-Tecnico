import { useEffect, useState } from "react";
import logo from "./assets/img/logo.png";

export default function App() {
  const [data, setData] = useState("cargando...");

  useEffect(() => {
    // 👇 TÍTULO DE LA PÁGINA
    document.title = "Sistema Técnicos | Inicio";

    fetch("http://localhost:3001/api/health")
      .then(res => res.json())
      .then(data => setData(JSON.stringify(data)))
      .catch(err => setData("ERROR: " + err.message));
  }, []);

  return (
    <div style={{ padding: 40 }}>
      <img src={logo} alt="Logo" width={80} />
      <h1>Sistema Técnicos</h1>
      <p>{data}</p>
    </div>
  );
}
