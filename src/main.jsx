import React from "react";
import ReactDOM from "react-dom/client";

import { BrowserRouter } from "react-router-dom";
import { registerSW } from "virtual:pwa-register";

import App from "./App.jsx";

import { AuthProvider } from "@/lib/AuthContext";
import { iniciarSincronizacionVentas } from "@/lib/salesRepository";
import { aplicarTemaInicial } from "@/lib/themes";

import "./index.css";

aplicarTemaInicial();

registerSW({
  immediate: true,
  onOfflineReady() {
    window.dispatchEvent(new Event("app-disponible-offline"));
  },
  onRegisterError(error) {
    console.error("No se pudo activar el modo offline:", error);
  },
});

iniciarSincronizacionVentas();

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
