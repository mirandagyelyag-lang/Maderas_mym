export const USERS_KEY = "mm_users";
export const SESSION_KEY = "user";

/*
  IMPORTANTE:
  Conservamos los valores internos históricos porque tus políticas RLS de Supabase
  ya usan 'administrador', 'vendedor', 'bodega' y 'caja'.

  En la interfaz mostramos nombres más claros para la empresa:
  - vendedor => Encargado
  - bodega   => Operador de barraca
*/
export const ROLES = {
  ADMINISTRADOR: "administrador",
  ENCARGADO: "vendedor",
  OPERADOR: "bodega",
  CAJA: "caja",

  // Alias de compatibilidad para código antiguo.
  VENDEDOR: "vendedor",
  BODEGA: "bodega",
};

export const ROLE_LABELS = {
  [ROLES.ADMINISTRADOR]: "Administrador",
  [ROLES.ENCARGADO]: "Encargado",
  [ROLES.OPERADOR]: "Operador de barraca",
  [ROLES.CAJA]: "Caja",
};

export const ROLE_DESCRIPTIONS = {
  [ROLES.ADMINISTRADOR]:
    "Acceso total: usuarios, configuración, bitácora y todos los módulos.",
  [ROLES.ENCARGADO]:
    "Gestiona ventas, clientes y cotizaciones. No administra usuarios.",
  [ROLES.OPERADOR]:
    "Trabajo de barraca: inventario, compras, proveedores y cubicación.",
  [ROLES.CAJA]:
    "Caja, ventas, gastos, reportes y clientes.",
};

export const PERMISSIONS = {
  DASHBOARD: "dashboard",
  INVENTARIO: "inventario",
  VENDER: "vender",
  VENTAS: "ventas",
  CAJA: "caja",
  REPORTES: "reportes",
  COMPRAS: "compras",
  PROVEEDORES: "proveedores",
  GASTOS: "gastos",
  CLIENTES: "clientes",
  COTIZACIONES: "cotizaciones",
  CUBICADOR: "cubicador",
  CONFIGURACION: "configuracion",
  USUARIOS: "usuarios",
  BITACORA: "bitacora",
};

export const ROLE_PERMISSIONS = {
  [ROLES.ADMINISTRADOR]: Object.values(PERMISSIONS),

  [ROLES.ENCARGADO]: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.CONFIGURACION,
    PERMISSIONS.VENDER,
    PERMISSIONS.VENTAS,
    PERMISSIONS.CLIENTES,
    PERMISSIONS.COTIZACIONES,
    PERMISSIONS.CUBICADOR,
  ],

  [ROLES.OPERADOR]: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.CONFIGURACION,
    PERMISSIONS.INVENTARIO,
    PERMISSIONS.COMPRAS,
    PERMISSIONS.PROVEEDORES,
    PERMISSIONS.CUBICADOR,
  ],

  [ROLES.CAJA]: [
    PERMISSIONS.DASHBOARD,
    PERMISSIONS.CONFIGURACION,
    PERMISSIONS.CAJA,
    PERMISSIONS.VENTAS,
    PERMISSIONS.GASTOS,
    PERMISSIONS.REPORTES,
    PERMISSIONS.CLIENTES,
  ],
};

function stableCode(value) {
  const source = String(value || "maderas-mm");
  let hash = 0;

  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }

  return `MM-${hash.toString(36).toUpperCase().padStart(6, "0").slice(-6)}`;
}

export function createCompanyIdentity(userId) {
  const id = `empresa-${String(userId)}`;

  return {
    empresaId: id,
    companyCode: stableCode(id),
  };
}

export function normalizeCompanyCode(value) {
  return String(value || "").trim().toUpperCase();
}

export function normalizeRole(role) {
  return ROLE_PERMISSIONS[role] ? role : ROLES.ENCARGADO;
}

export function getUserPermissions(user) {
  if (!user) return [];

  if (normalizeRole(user.role) === ROLES.ADMINISTRADOR) {
    return Object.values(PERMISSIONS);
  }

  if (Array.isArray(user.permissions)) {
    /*
      Conservamos CONFIGURACION por compatibilidad con la configuración
      personal de tema/perfil que ya tenía tu app. No concede USUARIOS.
    */
    return Array.from(
      new Set([...user.permissions, PERMISSIONS.CONFIGURACION])
    );
  }

  return ROLE_PERMISSIONS[normalizeRole(user.role)] || [];
}

export function hasPermission(user, permission) {
  if (!permission) return true;

  return getUserPermissions(user).includes(permission);
}

export function normalizeStoredUsers(users) {
  if (!Array.isArray(users)) return [];

  const firstAdmin =
    users.find((user) => user.role === ROLES.ADMINISTRADOR) || users[0];
  const legacyCompany = createCompanyIdentity(firstAdmin?.id || "principal");

  return users.map((user, index) => {
    const company = user.empresaId
      ? {
          empresaId: user.empresaId,
          companyCode:
            normalizeCompanyCode(user.companyCode) ||
            stableCode(user.empresaId),
        }
      : legacyCompany;

    return {
      ...user,
      ...company,
      role:
        user.role ||
        (index === 0 ? ROLES.ADMINISTRADOR : ROLES.ENCARGADO),
      active:
        user.active === undefined ? true : Boolean(user.active),
      status: user.status || "active",
      themeId:
        user.themeId ||
        (typeof localStorage !== "undefined"
          ? localStorage.getItem("tema_aplicacion")
          : null) ||
        "oscuro-mm",
    };
  });
}

export function createSessionUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    empresaId: user.empresaId || "",
    companyCode: normalizeCompanyCode(user.companyCode),
    phone: user.phone || "",
    jobTitle: user.jobTitle || "",
    themeId: user.themeId || "oscuro-mm",
    logoMode: user.logoMode || "auto",
    logoVariant: user.logoVariant || "/logo.png",
    status: user.status || "active",
    active: user.active !== false,
    createdAt: user.createdAt || user.created_at || "",
    permissions: Array.isArray(user.permissions)
      ? user.permissions
      : undefined,
  };
}

export function getDefaultRoute(user) {
  const orderedRoutes = [
    [PERMISSIONS.DASHBOARD, "/dashboard"],
    [PERMISSIONS.CUBICADOR, "/cubicador"],
    [PERMISSIONS.VENDER, "/vender"],
    [PERMISSIONS.INVENTARIO, "/inventario"],
    [PERMISSIONS.CAJA, "/caja"],
    [PERMISSIONS.VENTAS, "/ventas"],
  ];

  return (
    orderedRoutes.find(([permission]) =>
      hasPermission(user, permission)
    )?.[1] || "/inicio"
  );
}
