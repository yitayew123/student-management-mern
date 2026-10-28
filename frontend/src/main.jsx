import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

import "./styles/global.css";
import "./styles/layout.css";
import "./styles/components.css";
import "./styles/dashboard.css";

const container = document.getElementById("root");

if (!container) {
  throw new Error(
    'Root element #root not found. Ensure index.html contains <div id="root"></div>.',
  );
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
