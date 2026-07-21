// ================================
// M&M Business Control Database
// ================================

// Claves de localStorage
export const DB_KEYS = {
  INVENTARIO: "inventario",
  VENTAS: "ventas",
  CLIENTES: "clientes",
  GASTOS: "gastos",
  COTIZACIONES: "cotizaciones",
  EMPRESA: "configuracion_empresa",
  USUARIO: "user",
};

// ---------------------
// Funciones privadas
// ---------------------

function read(key, fallback = []) {
  try {
    const data = localStorage.getItem(key);

    if (!data) return fallback;

    return JSON.parse(data);
  } catch (error) {
    console.error(`Error leyendo ${key}:`, error);
    return fallback;
  }
}

function write(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`Error guardando ${key}:`, error);
    return false;
  }
}

// ================================
// INVENTARIO
// ================================

export const getProductos = () =>
  read(DB_KEYS.INVENTARIO);

export const saveProductos = (productos) =>
  write(DB_KEYS.INVENTARIO, productos);

// ================================
// VENTAS
// ================================

export const getVentas = () =>
  read(DB_KEYS.VENTAS);

export const saveVentas = (ventas) =>
  write(DB_KEYS.VENTAS, ventas);

// ================================
// CLIENTES
// ================================

export const getClientes = () =>
  read(DB_KEYS.CLIENTES);

export const saveClientes = (clientes) =>
  write(DB_KEYS.CLIENTES, clientes);

// ================================
// GASTOS
// ================================

export const getGastos = () =>
  read(DB_KEYS.GASTOS);

export const saveGastos = (gastos) =>
  write(DB_KEYS.GASTOS, gastos);

// ================================
// COTIZACIONES
// ================================

export const getCotizaciones = () =>
  read(DB_KEYS.COTIZACIONES);

export const saveCotizaciones = (cotizaciones) =>
  write(DB_KEYS.COTIZACIONES, cotizaciones);

// ================================
// EMPRESA
// ================================

export const getEmpresa = () =>
  read(DB_KEYS.EMPRESA, {});

export const saveEmpresa = (empresa) =>
  write(DB_KEYS.EMPRESA, empresa);

// ================================
// USUARIO
// ================================

export const getUsuario = () =>
  read(DB_KEYS.USUARIO, null);

export const saveUsuario = (usuario) =>
  write(DB_KEYS.USUARIO, usuario);

// ================================
// UTILIDADES
// ================================

export function generarId() {
  if (
    typeof crypto !== "undefined" &&
    crypto.randomUUID
  ) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random()
    .toString(36)
    .substring(2, 10)}`;
}

export function limpiarBaseDeDatos() {
  Object.values(DB_KEYS).forEach((key) =>
    localStorage.removeItem(key)
  );
}

export function exportarBaseDeDatos() {
  const respaldo = {};

  Object.entries(DB_KEYS).forEach(([nombre, key]) => {
    respaldo[nombre] = read(key, null);
  });

  return respaldo;
}

export function importarBaseDeDatos(datos) {
  Object.entries(DB_KEYS).forEach(([nombre, key]) => {
    if (datos[nombre] !== undefined) {
      write(key, datos[nombre]);
    }
  });
}