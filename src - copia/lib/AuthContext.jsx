import React, { createContext, useState, useContext, useEffect } from 'react';
import { appParams } from '@/lib/app-params';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  // 👑 MODO DIOS: Datos de usuario persistentes
  const [user, setUser] = useState({ 
    role: 'admin', 
    email: 'admin@maderas.cl', 
    full_name: 'Administradora' 
  }); 
  
  const [isAuthenticated, setIsAuthenticated] = useState(true);
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(true);

  // 🎨 CONFIGURACIÓN DE DISEÑO FORZADA (Aquí recuperamos tu logo y colores)
  const [appPublicSettings, setAppPublicSettings] = useState({ 
    id: 'maderas', 
    public_settings: {
      app_name: "Maderas Gestión",
      theme_primary: "#1e293b", // Ajusta aquí tus colores corporativos
      logo_url: "/logo.png",    // Asegúrate que tu logo esté en la carpeta 'public'
      is_customized: true
    } 
  });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    // Si falla la conexión, mantenemos los valores de arriba (los de "Maderas")
    if (!appParams?.appId || appParams?.appId === 'null') {
      console.warn('Modo contingencia local activo.');
      return;
    }

    try {
      setIsLoadingPublicSettings(true);
      
      if (typeof createAxiosClient !== 'undefined') {
        const appClient = createAxiosClient({
          baseURL: `/api/apps/public`,
          headers: { 'X-App-Id': appParams.appId },
          token: appParams.token,
          interceptResponses: true
        });
        
        const publicSettings = await appClient.get(`/prod/public-settings/by-id/${appParams.appId}`);
        // Solo sobrescribimos si el servidor nos devuelve algo real
        if (publicSettings) {
           setAppPublicSettings(publicSettings);
        }
      }
      
      if (appParams?.token) {
        await checkUserAuth();
      }
      setIsLoadingPublicSettings(false);
    } catch (error) {
      console.warn('Usando configuración local por respaldo.');
      setIsLoadingPublicSettings(false);
    }
  };

  const checkUserAuth = async () => {
    try {
      setIsLoadingAuth(true);
      let currentUser = null;
      
      if (typeof base44 !== 'undefined' && base44?.auth) {
        currentUser = await base44.auth.me();
      }
      
      setUser({
        ...(currentUser || {}),
        role: 'admin',
        email: currentUser?.email || 'admin@maderas.cl',
        full_name: currentUser?.full_name || 'Administradora'
      });
      
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    } catch (error) {
      setUser({ role: 'admin', email: 'admin@maderas.cl', full_name: 'Administradora' });
      setIsAuthenticated(true);
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    if (typeof base44 !== 'undefined' && base44?.auth) {
      shouldRedirect ? base44.auth.logout(window.location.href) : base44.auth.logout();
    }
  };

  const navigateToLogin = () => {
    if (typeof base44 !== 'undefined' && base44?.auth) {
      base44.auth.redirectToLogin(window.location.href);
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe estar dentro de AuthProvider');
  return context;
};