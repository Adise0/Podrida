import { endpoints } from "@podrida/shared";
import { useEffect, useState } from "react";
import { api } from "./api/client";
import "./App.css";

type Status = "checking" | "online" | "offline";

function App() {
  const [status, setStatus] = useState<Status>("checking");

  useEffect(() => {
    // The path comes from @podrida/shared: if the backend renames it, this stops compiling.
    api(endpoints.health.path)
      .then(() => setStatus("online"))
      .catch(() => setStatus("offline"));
  }, []);

  return (
    <main>
      <h1>Podrida</h1>
      <p>Server: {status}</p>
    </main>
  );
}

export default App;
