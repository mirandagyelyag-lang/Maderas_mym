import React from "react";

import {
  Navigate,
  Outlet,
  useLocation,
} from "react-router-dom";

import { useAuth } from "@/lib/AuthContext";
import {
  getDefaultRoute,
  hasPermission,
} from "@/lib/permissions";

export default function ProtectedRoute({
  children,
  requiredPermission,
  allowedRoles,
}) {
  const {
    user,
    isAuthenticated,
    loading,
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return (
      <div className="protected-route-loading">
        Cargando...
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/inicio"
        replace
        state={{ from: location }}
      />
    );
  }

  const roleAllowed =
    !Array.isArray(allowedRoles) ||
    allowedRoles.length === 0 ||
    allowedRoles.includes(user?.role);

  const permissionAllowed = hasPermission(
    user,
    requiredPermission
  );

  if (!roleAllowed || !permissionAllowed) {
    return (
      <Navigate
        to={getDefaultRoute(user)}
        replace
      />
    );
  }

  return children || <Outlet />;
}
