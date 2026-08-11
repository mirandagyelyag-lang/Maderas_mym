import { createContext, useContext, useEffect, useState } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";
import { lockVelvetPortrait } from "../utils/lockOrientation";

const PWAContext = createContext(null);
const INSTALL_DISMISSED_KEY = "velvet_install_prompt_dismissed";

export function PWAProvider({ children }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [installDismissed, setInstallDismissed] = useState(
    () => localStorage.getItem(INSTALL_DISMISSED_KEY) === "true"
  );
  const [showIOSInstructions, setShowIOSInstructions] = useState(false);
  const [online, setOnline] = useState(() => navigator.onLine);
  const [installed, setInstalled] = useState(isStandalone);
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    void lockVelvetPortrait();
    const relock = () => { if (document.visibilityState === "visible") void lockVelvetPortrait(); };
    document.addEventListener("visibilitychange", relock);
    window.addEventListener("orientationchange", relock);
    return () => {
      document.removeEventListener("visibilitychange", relock);
      window.removeEventListener("orientationchange", relock);
    };
  }, [installed]);

  useEffect(() => {
    function captureInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }
    function markInstalled() {
      setInstalled(true);
      setInstallPrompt(null);
      localStorage.removeItem(INSTALL_DISMISSED_KEY);
    }
    function goOnline() { setOnline(true); }
    function goOffline() { setOnline(false); }

    window.addEventListener("beforeinstallprompt", captureInstallPrompt);
    window.addEventListener("appinstalled", markInstalled);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("beforeinstallprompt", captureInstallPrompt);
      window.removeEventListener("appinstalled", markInstalled);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  async function installApp() {
    if (installed) return { outcome: "installed" };
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setInstallPrompt(null);
        setInstalled(true);
        window.setTimeout(() => void lockVelvetPortrait(), 250);
      }
      return choice;
    }
    if (isIOS()) {
      setShowIOSInstructions(true);
      return { outcome: "instructions" };
    }
    setShowIOSInstructions(true);
    return { outcome: "instructions" };
  }

  function dismissInstall() {
    localStorage.setItem(INSTALL_DISMISSED_KEY, "true");
    setInstallDismissed(true);
  }

  const value = {
    canInstall: Boolean(installPrompt) || (isIOS() && !installed),
    installed,
    installDismissed,
    installApp,
    dismissInstall,
    showIOSInstructions,
    closeIOSInstructions: () => setShowIOSInstructions(false),
    online,
    offlineReady,
    dismissOfflineReady: () => setOfflineReady(false),
    needRefresh,
    dismissRefresh: () => setNeedRefresh(false),
    updateApp: () => updateServiceWorker(true),
    platform: isIOS() ? "ios" : "other",
  };

  return <PWAContext.Provider value={value}>{children}</PWAContext.Provider>;
}

function isIOS() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
}

export function usePWA() {
  const context = useContext(PWAContext);
  if (!context) throw new Error("usePWA must be used inside PWAProvider");
  return context;
}
