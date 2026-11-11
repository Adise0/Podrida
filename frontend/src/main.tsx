import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import { wireApiClient } from "./stores/wireApiClient";

// Before anything renders: the API client needs to know about the session from the first request.
wireApiClient();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
