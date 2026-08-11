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

let reloadingForUpdate = false;
let updateSW = async () => undefined;

updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new Event("app-actualizacion-disponible"));
    updateSW(true).catch((error) => {
      console.error("No se pudo aplicar la actualización:", error);
    });
  },
  onRegisteredSW(_swUrl, registration) {
    registration?.update().catch((error) => {
      console.error("No se pudo comprobar la actualización:", error);
    });
  },
  onOfflineReady() {
    window.dispatchEvent(new Event("app-disponible-offline"));
  },
  onRegisterError(error) {
    console.error("No se pudo activar el modo offline:", error);
  },
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadingForUpdate) return;
    reloadingForUpdate = true;
    window.location.reload();
  });
}

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
