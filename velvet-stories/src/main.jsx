import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { AuthProvider } from "./context/AuthContext";
import { CharactersProvider } from "./context/CharactersContext";
import { ChatsProvider } from "./context/ChatsContext";
import { FeedbackProvider } from "./context/FeedbackContext";
import { LorebooksProvider } from "./context/LorebooksContext";
import { PersonasProvider } from "./context/PersonasContext";
import { PWAProvider } from "./context/PWAContext";
import { SettingsProvider } from "./context/SettingsContext";
import { ThemeProvider } from "./context/ThemeContext";

import App from "./App";
import "./index.css";
import "./styles/mobile-v71.css";

if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((registrations) => {
    registrations.forEach((registration) => registration.unregister());
  });

  if ("caches" in window) {
    caches.keys().then((keys) => {
      keys
        .filter((key) => key.includes("workbox") || key.includes("precache"))
        .forEach((key) => caches.delete(key));
    });
  }
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <PWAProvider>
      <ThemeProvider>
        <SettingsProvider>
          <FeedbackProvider>
            <AuthProvider>
              <CharactersProvider>
                <PersonasProvider>
                  <LorebooksProvider>
                    <ChatsProvider>
                      <App />
                    </ChatsProvider>
                  </LorebooksProvider>
                </PersonasProvider>
              </CharactersProvider>
            </AuthProvider>
          </FeedbackProvider>
        </SettingsProvider>
      </ThemeProvider>
    </PWAProvider>
  </StrictMode>
);
