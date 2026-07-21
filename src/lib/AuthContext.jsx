import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

const AuthContext = createContext(null);

const SESSION_KEY = "user";

function readStoredUser() {
  try {
    const storedUser =
      localStorage.getItem(SESSION_KEY);

    return storedUser
      ? JSON.parse(storedUser)
      : null;
  } catch (error) {
    console.error(
      "No se pudo leer la sesión:",
      error
    );

    localStorage.removeItem(
      SESSION_KEY
    );

    return null;
  }
}

export function AuthProvider({
  children,
}) {
  const [user, setUser] = useState(
    () => readStoredUser()
  );

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    setUser(readStoredUser());
    setLoading(false);

    function handleStorage(event) {
      if (
        !event.key ||
        event.key === SESSION_KEY
      ) {
        setUser(readStoredUser());
      }
    }

    function handleAuthChange() {
      setUser(readStoredUser());
    }

    window.addEventListener(
      "storage",
      handleStorage
    );

    window.addEventListener(
      "auth-changed",
      handleAuthChange
    );

    return () => {
      window.removeEventListener(
        "storage",
        handleStorage
      );

      window.removeEventListener(
        "auth-changed",
        handleAuthChange
      );
    };
  }, []);

  function login(userData) {
    try {
      localStorage.setItem(
        SESSION_KEY,
        JSON.stringify(userData)
      );

      setUser(userData);

      window.dispatchEvent(
        new Event("auth-changed")
      );

      return true;
    } catch (error) {
      console.error(
        "No se pudo iniciar sesión:",
        error
      );

      return false;
    }
  }

  function logout() {
    localStorage.removeItem(
      SESSION_KEY
    );

    setUser(null);

    window.dispatchEvent(
      new Event("auth-changed")
    );
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated:
        Boolean(user),
      login,
      logout,
      setUser,
    }),
    [user, loading]
  );

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context =
    useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth debe utilizarse dentro de AuthProvider."
    );
  }

  return context;
}

export default AuthContext;