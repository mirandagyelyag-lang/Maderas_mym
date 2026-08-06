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
  SESSION_KEY,
} from "@/lib/permissions";
import { registrarActividad } from "@/lib/database";
import { esErrorDeConexion } from "@/lib/offlineDb";
import { supabase } from "@/lib/supabase";
import { aplicarTema } from "@/lib/themes";

const AuthContext = createContext(null);

function readCachedSession() {
  try {
    const value = localStorage.getItem(SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.error("No se pudo leer la sesión guardada:", error);
    return null;
  }
}

function profileToSession(profile) {
  if (!profile) return null;

  return createSessionUser({
    id: profile.id,
    name: profile.name,
    email: profile.email,
    role: profile.role,
    status: profile.status,
    active: profile.active,
    phone: profile.phone,
    jobTitle: profile.job_title,
    themeId: profile.theme_id,
    logoMode: profile.logo_mode,
    logoVariant: profile.logo_variant,
    createdAt: profile.created_at,
  });
}

function cacheSession(user) {
  if (user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(user));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

export function AuthProvider({ children }) {
  const [user, setUserState] = useState(() => readCachedSession());
  const [loading, setLoading] = useState(true);

  function useCachedUser(authUser) {
    const cached = readCachedSession();

    if (
      cached?.id &&
      authUser?.id &&
      String(cached.id) === String(authUser.id)
    ) {
      setUserState(cached);

      if (cached.themeId) {
        aplicarTema(cached.themeId);
      }

      return cached;
    }

    return null;
  }

  async function loadProfile(authUser) {
    if (!authUser?.id) {
      cacheSession(null);
      setUserState(null);
      return null;
    }

    const { data: profile, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authUser.id)
      .single();

    if (error || !profile) {
      if (esErrorDeConexion(error)) {
        const cached = useCachedUser(authUser);

        if (cached) return cached;
      }

      console.error("No se pudo cargar el perfil:", error);
      cacheSession(null);
      setUserState(null);
      return null;
    }

    if (profile.status !== "active" || profile.active !== true) {
      cacheSession(null);
      setUserState(null);
      await supabase.auth.signOut();
      return null;
    }

    const sessionUser = profileToSession(profile);

    cacheSession(sessionUser);
    setUserState(sessionUser);

    if (sessionUser?.themeId) {
      aplicarTema(sessionUser.themeId);
    }

    return sessionUser;
  }

  async function refreshUser() {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error) {
      if (esErrorDeConexion(error)) {
        return user;
      }

      throw error;
    }

    return loadProfile(session?.user || null);
  }

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      try {
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession();

        if (!mounted) return;

        if (error) {
          if (!esErrorDeConexion(error)) {
            console.error("No se pudo comprobar la sesión:", error);
            cacheSession(null);
            setUserState(null);
          }
          return;
        }

        await loadProfile(session?.user || null);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initialize();

    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        window.setTimeout(async () => {
          if (!mounted) return;

          if (!session?.user && !navigator.onLine && readCachedSession()) {
            setLoading(false);
            return;
          }

          await loadProfile(session?.user || null);
          setLoading(false);
        }, 0);
      }
    );

    const handleProfilesUpdated = () => {
      if (navigator.onLine) {
        refreshUser().catch((error) => {
          console.error("No se pudo actualizar el perfil:", error);
        });
      }
    };

    window.addEventListener(
      "usuarios-actualizados",
      handleProfilesUpdated
    );
    window.addEventListener("online", handleProfilesUpdated);

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
      window.removeEventListener(
        "usuarios-actualizados",
        handleProfilesUpdated
      );
      window.removeEventListener("online", handleProfilesUpdated);
    };
  }, []);

  async function login(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { success: false, error };
    }

    const sessionUser = await loadProfile(data.user);

    if (!sessionUser) {
      return {
        success: false,
        error: new Error("La cuenta está pendiente o inactiva."),
      };
    }

    registrarActividad({
      accion: "iniciar_sesion",
      modulo: "Autenticación",
      entidadId: sessionUser.id,
      entidadNombre: sessionUser.name,
      descripcion: `${sessionUser.name} inició sesión`,
    });

    return { success: true, user: sessionUser };
  }

  async function logout() {
    if (user) {
      registrarActividad({
        accion: "cerrar_sesion",
        modulo: "Autenticación",
        entidadId: user.id,
        entidadNombre: user.name,
        descripcion: `${user.name} cerró sesión`,
      });
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("No se pudo cerrar la sesión:", error);
    }

    cacheSession(null);
    setUserState(null);
    return !error;
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      empresaId: "",
      login,
      logout,
      setUser: setUserState,
      refreshUser,
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
