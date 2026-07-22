import React, { useMemo, useState } from "react";

import {
  CheckCircle2,
  Clock3,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserRound,
  UserX,
  Users as UsersIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/lib/AuthContext";
import { registrarActividad } from "@/lib/database";
import {
  ROLE_LABELS,
  ROLES,
  normalizeStoredUsers,
  USERS_KEY,
} from "@/lib/permissions";

function readAllUsers() {
  try {
    return normalizeStoredUsers(
      JSON.parse(localStorage.getItem(USERS_KEY) || "[]")
    );
  } catch (error) {
    console.error("No se pudieron leer los usuarios:", error);
    return [];
  }
}

const resumirUsuario = (usuario) => ({
  nombre: usuario?.name || "",
  email: usuario?.email || "",
  rol: usuario?.role || "",
  estado: usuario?.status || "",
  activo: usuario?.active !== false,
});

export default function Usuarios() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState(() =>
    readAllUsers()
  );
  const [message, setMessage] = useState("");

  const pendingCount = useMemo(
    () =>
      users.filter((item) => item.status === "pending").length,
    [users]
  );

  function saveUsers(nextUsers, nextMessage) {
    localStorage.setItem(
      USERS_KEY,
      JSON.stringify(nextUsers)
    );
    setUsers(nextUsers);
    setMessage(nextMessage);
    window.dispatchEvent(new Event("usuarios-actualizados"));

    window.setTimeout(() => setMessage(""), 2400);
  }

  function updateUser(userId, changes, successMessage) {
    const nextUsers = users.map((item) =>
      String(item.id) === String(userId)
        ? { ...item, ...changes }
        : item
    );

    saveUsers(nextUsers, successMessage);
  }

  function approveUser(userId) {
    const targetUser = users.find(
      (item) => String(item.id) === String(userId)
    );

    if (!targetUser) return;

    const approvedUser = {
      ...targetUser,
      active: true,
      status: "active",
      empresaId: currentUser?.empresaId,
      companyCode: currentUser?.companyCode,
    };

    updateUser(
      userId,
      {
        active: true,
        status: "active",
        empresaId: currentUser?.empresaId,
        companyCode: currentUser?.companyCode,
      },
      "Usuario aprobado correctamente."
    );

    registrarActividad({
      accion: "aprobar_usuario",
      modulo: "Usuarios",
      entidadId: targetUser.id,
      entidadNombre: targetUser.name,
      descripcion: `Aprobó el acceso de ${targetUser.name}`,
      datosAntes: resumirUsuario(targetUser),
      datosDespues: resumirUsuario(approvedUser),
    });
  }

  function toggleUser(targetUser) {
    if (String(targetUser.id) === String(currentUser?.id)) {
      setMessage("No puedes desactivar tu propia cuenta.");
      return;
    }

    if (
      targetUser.role === ROLES.ADMINISTRADOR &&
      targetUser.active !== false
    ) {
      const activeAdmins = users.filter(
        (item) =>
          item.role === ROLES.ADMINISTRADOR &&
          item.active !== false &&
          item.status !== "pending"
      );

      if (activeAdmins.length <= 1) {
        setMessage("Debe existir al menos un administrador activo.");
        return;
      }
    }

    const nextActive = targetUser.active === false;

    updateUser(
      targetUser.id,
      {
        active: nextActive,
        status: nextActive ? "active" : "inactive",
      },
      nextActive
        ? "Usuario activado."
        : "Usuario desactivado."
    );

    registrarActividad({
      accion: nextActive
        ? "activar_usuario"
        : "desactivar_usuario",
      modulo: "Usuarios",
      entidadId: targetUser.id,
      entidadNombre: targetUser.name,
      descripcion: `${
        nextActive ? "Activó" : "Desactivó"
      } la cuenta de ${targetUser.name}`,
      datosAntes: resumirUsuario(targetUser),
      datosDespues: resumirUsuario({
        ...targetUser,
        active: nextActive,
        status: nextActive ? "active" : "inactive",
      }),
    });
  }

  function changeRole(targetUser, role) {
    if (
      targetUser.role === ROLES.ADMINISTRADOR &&
      role !== ROLES.ADMINISTRADOR
    ) {
      const activeAdmins = users.filter(
        (item) =>
          item.role === ROLES.ADMINISTRADOR &&
          item.active !== false &&
          item.status !== "pending"
      );

      if (activeAdmins.length <= 1) {
        setMessage("No puedes cambiar el rol del último administrador.");
        return;
      }
    }

    updateUser(
      targetUser.id,
      { role },
      "Rol actualizado correctamente."
    );

    registrarActividad({
      accion: "cambiar_rol",
      modulo: "Usuarios",
      entidadId: targetUser.id,
      entidadNombre: targetUser.name,
      descripcion: `Cambió el rol de ${targetUser.name} de ${
        ROLE_LABELS[targetUser.role] || targetUser.role
      } a ${ROLE_LABELS[role] || role}`,
      datosAntes: resumirUsuario(targetUser),
      datosDespues: resumirUsuario({
        ...targetUser,
        role,
      }),
    });
  }

  function deleteUser(targetUser) {
    if (String(targetUser.id) === String(currentUser?.id)) {
      setMessage("No puedes eliminar tu propia cuenta.");
      return;
    }

    if (targetUser.role === ROLES.ADMINISTRADOR) {
      const admins = users.filter(
        (item) => item.role === ROLES.ADMINISTRADOR
      );

      if (admins.length <= 1) {
        setMessage("No puedes eliminar el último administrador.");
        return;
      }
    }

    if (
      !window.confirm(
        `¿Eliminar la cuenta de ${targetUser.name}?`
      )
    ) {
      return;
    }

    saveUsers(
      users.filter(
        (item) => String(item.id) !== String(targetUser.id)
      ),
      "Usuario eliminado."
    );

    registrarActividad({
      accion:
        targetUser.status === "pending"
          ? "rechazar_usuario"
          : "eliminar_usuario",
      modulo: "Usuarios",
      entidadId: targetUser.id,
      entidadNombre: targetUser.name,
      descripcion:
        targetUser.status === "pending"
          ? `Rechazó la solicitud de acceso de ${targetUser.name}`
          : `Eliminó la cuenta de ${targetUser.name}`,
      datosAntes: resumirUsuario(targetUser),
    });
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-primary/15 flex items-center justify-center">
              <UsersIcon className="w-5 h-5 text-primary" />
            </div>

            <div>
              <h1 className="text-3xl font-bold">Usuarios</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Administra accesos, estados y responsabilidades.
              </p>
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <Card className="px-4 py-3 border-border bg-card">
            <p className="text-xs text-muted-foreground">Cuentas</p>
            <p className="text-lg font-semibold">{users.length}</p>
          </Card>

          <Card className="px-4 py-3 border-border bg-card">
            <p className="text-xs text-muted-foreground">Pendientes</p>
            <p className="text-lg font-semibold text-primary">
              {pendingCount}
            </p>
          </Card>

          <Card className="px-4 py-3 border-border bg-card">
            <p className="text-xs text-muted-foreground">
              Código de empresa
            </p>
            <p className="text-lg font-semibold tracking-wider text-primary">
              {currentUser?.companyCode || "Sin código"}
            </p>
          </Card>
        </div>
      </div>

      {message && (
        <div className="mb-5 rounded-xl border border-primary/25 bg-primary/10 px-4 py-3 text-sm text-foreground">
          {message}
        </div>
      )}

      {users.length === 0 ? (
        <Card className="p-12 text-center border-border bg-card">
          <UserRound className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-45" />
          <p className="font-medium">No existen usuarios registrados</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {users.map((account) => {
            const pending = account.status === "pending";
            const active = account.active !== false && !pending;
            const isCurrent =
              String(account.id) === String(currentUser?.id);

            return (
              <Card
                key={account.id}
                className="p-5 border-border bg-card"
              >
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-primary/12 text-primary flex items-center justify-center font-bold text-lg shrink-0">
                    {account.name?.charAt(0).toUpperCase() || "?"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-semibold truncate">
                        {account.name}
                      </h2>

                      {isCurrent && (
                        <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          TU CUENTA
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-muted-foreground truncate mt-1">
                      {account.email}
                    </p>
                  </div>

                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                      pending
                        ? "bg-amber-500/12 text-amber-500"
                        : active
                          ? "bg-emerald-500/12 text-emerald-500"
                          : "bg-destructive/12 text-destructive"
                    }`}
                  >
                    {pending ? (
                      <Clock3 className="w-3.5 h-3.5" />
                    ) : active ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <UserX className="w-3.5 h-3.5" />
                    )}

                    {pending ? "Pendiente" : active ? "Activo" : "Inactivo"}
                  </span>
                </div>

                <div className="mt-5 rounded-xl border border-border bg-muted/15 p-4">
                  <label className="text-xs text-muted-foreground">
                    Rol y permisos
                  </label>

                  <div className="flex items-center gap-2 mt-2">
                    <ShieldCheck className="w-4 h-4 text-primary" />

                    <select
                      value={account.role}
                      onChange={(event) =>
                        changeRole(account, event.target.value)
                      }
                      className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
                    >
                      {Object.entries(ROLE_LABELS).map(
                        ([role, label]) => (
                          <option key={role} value={role}>
                            {label}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                </div>

                <div className="flex flex-wrap justify-end gap-2 mt-4">
                  {pending && (
                    <Button
                      type="button"
                      onClick={() => approveUser(account.id)}
                    >
                      <UserCheck className="w-4 h-4 mr-2" />
                      Aprobar acceso
                    </Button>
                  )}

                  {!pending && !isCurrent && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => toggleUser(account)}
                    >
                      {active ? "Desactivar" : "Activar"}
                    </Button>
                  )}

                  {!isCurrent && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => deleteUser(account)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}