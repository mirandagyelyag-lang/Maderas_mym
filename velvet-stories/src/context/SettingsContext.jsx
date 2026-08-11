import { createContext, useContext, useEffect, useState } from "react";

const SettingsContext = createContext();
const STORAGE_KEY = "velvet_general_settings";
const defaults = {
  textSize: "comfortable",
  density: "comfortable",
  reduceMotion: false,
  showMessageTimestamps: false,
  haptics: true,
  confirmBeforeDelete: true,
  exportFormat: "markdown",
};

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(() => {
    try { return { ...defaults, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") }; }
    catch { return defaults; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    document.documentElement.dataset.textSize = settings.textSize;
    document.documentElement.dataset.density = settings.density;
    document.documentElement.dataset.reduceMotion = String(settings.reduceMotion);
  }, [settings]);

  function updateSetting(name, value) {
    setSettings((current) => ({ ...current, [name]: value }));
  }

  function resetSettings() { setSettings(defaults); }

  return <SettingsContext.Provider value={{ settings, updateSetting, resetSettings }}>{children}</SettingsContext.Provider>;
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) throw new Error("useSettings must be used inside SettingsProvider");
  return context;
}
