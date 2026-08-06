import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

const DISMISSED_KEY = "mm_install_prompt_dismissed";

export default function InstallAppPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const isInstalled = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
    if (isInstalled) return;

    const handlePrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
      if (sessionStorage.getItem(DISMISSED_KEY) !== "true") setVisible(true);
    };
    const handleInstalled = () => { setVisible(false); setInstallEvent(null); };
    window.addEventListener("beforeinstallprompt", handlePrompt);
    window.addEventListener("appinstalled", handleInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", handlePrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") { setVisible(false); setInstallEvent(null); }
  };

  const dismiss = () => {
    sessionStorage.setItem(DISMISSED_KEY, "true");
    setVisible(false);
  };

  if (!visible || !installEvent) return null;

  return (
    <aside className="fixed bottom-4 right-4 z-[100] w-[min(24rem,calc(100vw-2rem))] rounded-2xl border border-primary/25 bg-card/95 p-4 text-foreground shadow-2xl backdrop-blur-xl">
      <button type="button" onClick={dismiss} aria-label="Cerrar" className="absolute right-3 top-3 rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"><X className="h-4 w-4" /></button>
      <div className="flex items-center gap-3 pr-7">
        <img src="/pwa-192x192.png" alt="" className="h-14 w-14 rounded-xl border border-primary/20" />
        <div>
          <strong className="block text-sm">Instalar Maderas M&M</strong>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">Úsala como una aplicación y accede más rápido desde este dispositivo.</p>
        </div>
      </div>
      <button type="button" onClick={install} className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-primary-foreground shadow-lg shadow-primary/20 transition hover:brightness-105">
        <Download className="h-4 w-4" /> Instalar aplicación
      </button>
    </aside>
  );
}
