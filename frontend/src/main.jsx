import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { applyLightAppearance } from "./lib/appearance.js";
import "./index.css";

applyLightAppearance(document.documentElement, window);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App></App>
  </StrictMode>,
);
