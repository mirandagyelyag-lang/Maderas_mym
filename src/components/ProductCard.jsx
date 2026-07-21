import React from "react";
import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";

function AuthLoadingScreen() {
  return (
    <div className="fixed inset-0 grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-4">
        <div className="h-9 w-9 animate-spin rounded-full border-4 border-border border-t-primary" />

        <p className="text-sm text-muted-foreground">
          Comprobando sesión...
        </p>
      </div>
    </div>
  );
}

export default function ProtectedRoute({
  allowedRoles,
  fallback = <AuthLoadingScreen />,
}) {
  const location = useLocation();

  const {
    user,
    isAuthenticated,
    isLoadingAuth,
    authChecked,
  } = useAuth();

  if (isLoadingAuth || !authChecked) {
    return fallback;
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/inicio"
        replace
        state={{
          from: location.pathname,
        }}
      />
    );
  }

  if (
    Array.isArray(allowedRoles) &&
    allowedRoles.length > 0 &&
    !allowedRoles.includes(user?.role)
  ) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    );
  }

  return <Outlet />;
}