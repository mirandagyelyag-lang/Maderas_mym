// ================================
// M&M Business Control Database
// ================================

// Claves de localStorage
export const DB_KEYS = {
  INVENTARIO: "inventario",
  VENTAS: "ventas",
  CLIENTES: "mis_clientes_data",
  DEUDAS_CLIENTES: "deudas_clientes_barraca",
  GASTOS: "gastos",
  COTIZACIONES: "cotizaciones",
  BITACORA: "bitacora_actividad",
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

function readSharedCollection(key) {
  const records = read(key, []);
  return Array.isArray(records) ? records : [];
}

const writeSharedCollection = (key, records) =>
  write(key, Array.isArray(records) ? records : []);

// ================================
// INVENTARIO
// ================================

export const getProductos = () =>
  readSharedCollection(DB_KEYS.INVENTARIO);

export const saveProductos = (productos) =>
  writeSharedCollection(DB_KEYS.INVENTARIO, productos);

// ================================
// VENTAS
// ================================

export const getVentas = () =>
  readSharedCollection(DB_KEYS.VENTAS);

export const saveVentas = (ventas) =>
  writeSharedCollection(DB_KEYS.VENTAS, ventas);

// ================================
// CLIENTES
// ================================

export const getClientes = () =>
  readSharedCollection(DB_KEYS.CLIENTES);

export const saveClientes = (clientes) =>
  writeSharedCollection(DB_KEYS.CLIENTES, clientes);

export function getDeudasClientes() {
  const guardadas = read(DB_KEYS.DEUDAS_CLIENTES, {});
  const todas =
    guardadas && typeof guardadas === "object"
      ? guardadas
      : {};

  const formatoSeparadoPorEmpresa = Object.values(todas).some(
    (valor) =>
      valor &&
      typeof valor === "object" &&
      !Array.isArray(valor)
  );

  if (!formatoSeparadoPorEmpresa) {
    return todas;
  }

  const deudasCompartidas = Object.entries(todas).reduce(
    (resultado, [clave, valor]) => {
      if (Array.isArray(valor)) {
        resultado[clave] = valor;
      } else if (valor && typeof valor === "object") {
        Object.assign(resultado, valor);
      }

      return resultado;
    },
    {}
  );

  write(DB_KEYS.DEUDAS_CLIENTES, deudasCompartidas);
  return deudasCompartidas;
}

export function saveDeudasClientes(deudas) {
  return write(
    DB_KEYS.DEUDAS_CLIENTES,
    deudas && typeof deudas === "object" ? deudas : {}
  );
}

// ================================
// GASTOS
// ================================

export const getGastos = () =>
  readSharedCollection(DB_KEYS.GASTOS);

export const saveGastos = (gastos) =>
  writeSharedCollection(DB_KEYS.GASTOS, gastos);

// ================================
// COTIZACIONES
// ================================

export const getCotizaciones = () =>
  readSharedCollection(DB_KEYS.COTIZACIONES);

export const saveCotizaciones = (cotizaciones) =>
  writeSharedCollection(DB_KEYS.COTIZACIONES, cotizaciones);

// ================================
// BITÁCORA DE ACTIVIDAD
// ================================

const CAMPOS_SENSIBLES = [
  "password",
  "contrasena",
  "contraseña",
  "confirmPassword",
  "confirmarContrasena",
];

function limpiarDatosActividad(datos) {
  if (datos === undefined || datos === null) return null;

  if (Array.isArray(datos)) {
    return datos.slice(0, 25).map(limpiarDatosActividad);
  }

  if (typeof datos !== "object") {
    return datos;
  }

  return Object.entries(datos).reduce((resultado, [clave, valor]) => {
    if (!CAMPOS_SENSIBLES.includes(clave)) {
      resultado[clave] = limpiarDatosActividad(valor);
    }

    return resultado;
  }, {});
}

export const getBitacora = () =>
  readSharedCollection(DB_KEYS.BITACORA).sort(
    (a, b) => new Date(b.fecha) - new Date(a.fecha)
  );

export function registrarActividad({
  accion,
  modulo,
  entidadId = "",
  entidadNombre = "",
  descripcion = "",
  datosAntes = null,
  datosDespues = null,
}) {
  if (!accion || !modulo) return null;

  const usuario = getUsuario();
  const actividad = {
    id: generarId(),
    fecha: new Date().toISOString(),
    usuario_id: usuario?.id || "",
    usuario_nombre:
      usuario?.name || usuario?.nombre || "Usuario del sistema",
    usuario_email: usuario?.email || "",
    usuario_rol: usuario?.role || "",
    accion,
    modulo,
    entidad_id: entidadId,
    entidad_nombre: entidadNombre,
    descripcion:
      descripcion || `${accion} en ${modulo}`,
    datos_antes: limpiarDatosActividad(datosAntes),
    datos_despues: limpiarDatosActividad(datosDespues),
  };

  const actuales = readSharedCollection(DB_KEYS.BITACORA);
  const guardadas = [...actuales, actividad].slice(-2000);

  if (!writeSharedCollection(DB_KEYS.BITACORA, guardadas)) {
    return null;
  }

  window.dispatchEvent(
    new CustomEvent("bitacora-actualizada", {
      detail: actividad,
    })
  );

  return actividad;
}

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