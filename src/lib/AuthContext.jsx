import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  createSessionUser,
  hasPermission,
  normalizeStoredUsers,
  SESSION_KEY,
  USERS_KEY,
} from "@/lib/permissions";
import { aplicarTema } from "@/lib/themes";
import { registrarActividad } from "@/lib/database";

const AuthContext = createContext(null);

function readJSON(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    console.error(`No se pudo leer ${key}:`, error);
    return fallback;
  }
}

function readStoredUser() {
  try {
    const storedSession = readJSON(SESSION_KEY, null);

    if (!storedSession) return null;

    const storedUsers = normalizeStoredUsers(
      readJSON(USERS_KEY, [])
    );

    if (storedUsers.length > 0) {
      localStorage.setItem(USERS_KEY, JSON.stringify(storedUsers));

      const registeredUser = storedUsers.find(
        (item) =>
          String(item.id) === String(storedSession.id) ||
          String(item.email).toLowerCase() ===
            String(storedSession.email).toLowerCase()
      );

      if (!registeredUser) return storedSession;

      if (
        registeredUser.active === false ||
        registeredUser.status === "inactive" ||
        registeredUser.status === "pending"
      ) {
        localStorage.removeItem(SESSION_KEY);
        return null;
      }

      const session = createSessionUser(registeredUser);

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      return session;
    }

    return storedSession;
  } catch (error) {
    console.error("No se pudo leer la sesión:", error);
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setLoading(false);

    function refreshAuth() {
      setUser(readStoredUser());
    }

    function handleStorage(event) {
      if (
        !event.key ||
        event.key === SESSION_KEY ||
        event.key === USERS_KEY
      ) {
        refreshAuth();
      }
    }

    window.addEventListener("storage", handleStorage);
    window.addEventListener("auth-changed", refreshAuth);
    window.addEventListener("usuarios-actualizados", refreshAuth);

    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("auth-changed", refreshAuth);
      window.removeEventListener("usuarios-actualizados", refreshAuth);
    };
  }, []);

  useEffect(() => {
    if (user?.themeId) aplicarTema(user.themeId);
  }, [user?.id, user?.themeId]);

  function login(userData) {
    try {
      const session = createSessionUser(userData);

      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
      setUser(session);

      registrarActividad({
        accion: "iniciar_sesion",
        modulo: "Autenticación",
        entidadId: session.id,
        entidadNombre: session.name,
        descripcion: `${session.name} inició sesión`,
        datosDespues: {
          nombre: session.name,
          email: session.email,
          rol: session.role,
        },
      });

      window.dispatchEvent(new Event("auth-changed"));
      return true;
    } catch (error) {
      console.error("No se pudo iniciar sesión:", error);
      return false;
    }
  }

  function logout() {
    if (user) {
      registrarActividad({
        accion: "cerrar_sesion",
        modulo: "Autenticación",
        entidadId: user.id,
        entidadNombre: user.name,
        descripcion: `${user.name} cerró sesión`,
        datosAntes: {
          nombre: user.name,
          email: user.email,
          rol: user.role,
        },
      });
    }

    localStorage.removeItem(SESSION_KEY);
    setUser(null);
    window.dispatchEvent(new Event("auth-changed"));
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      empresaId: user?.empresaId || "",
      login,
      logout,
      setUser,
      can: (permission) => hasPermission(user, permission),
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider."
    );
  }

  return context;
}

export default AuthContext;