const DB_NAME = "maderas-mm-offline";
const DB_VERSION = 1;

const STORES = {
  CACHE: "cache",
  OUTBOX: "outbox",
};

function openDatabase() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) {
      reject(new Error("Este navegador no permite almacenamiento offline."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;

      if (!database.objectStoreNames.contains(STORES.CACHE)) {
        database.createObjectStore(STORES.CACHE, {
          keyPath: "key",
        });
      }

      if (!database.objectStoreNames.contains(STORES.OUTBOX)) {
        const outbox = database.createObjectStore(STORES.OUTBOX, {
          keyPath: "id",
        });

        outbox.createIndex("tipo", "tipo", { unique: false });
        outbox.createIndex("estado", "estado", { unique: false });
        outbox.createIndex("creadoEn", "creadoEn", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function runTransaction(storeName, mode, callback) {
  return openDatabase().then(
    (database) =>
      new Promise((resolve, reject) => {
        const transaction = database.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        let result;

        try {
          result = callback(store);
        } catch (error) {
          database.close();
          reject(error);
          return;
        }

        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };

        transaction.onerror = () => {
          database.close();
          reject(transaction.error);
        };

        transaction.onabort = () => {
          database.close();
          reject(transaction.error);
        };
      })
  );
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function guardarCache(key, value) {
  return runTransaction(STORES.CACHE, "readwrite", (store) => {
    store.put({
      key,
      value,
      actualizadoEn: new Date().toISOString(),
    });
  });
}

export async function leerCache(key, fallback = null) {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORES.CACHE, "readonly");
    const record = await requestResult(
      transaction.objectStore(STORES.CACHE).get(key)
    );

    return record?.value ?? fallback;
  } finally {
    database.close();
  }
}

export async function agregarPendiente(record) {
  const item = {
    ...record,
    id: String(record.id || crypto.randomUUID()),
    estado: record.estado || "pendiente",
    creadoEn: record.creadoEn || new Date().toISOString(),
    intentos: Number(record.intentos || 0),
  };

  await runTransaction(STORES.OUTBOX, "readwrite", (store) => {
    store.put(item);
  });

  window.dispatchEvent(new Event("operaciones-offline-actualizadas"));
  return item;
}

export async function listarPendientes(tipo = "") {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORES.OUTBOX, "readonly");
    const records = await requestResult(
      transaction.objectStore(STORES.OUTBOX).getAll()
    );

    return (records || [])
      .filter(
        (item) =>
          item.estado !== "sincronizado" &&
          (!tipo || item.tipo === tipo)
      )
      .sort(
        (a, b) =>
          new Date(a.creadoEn).getTime() -
          new Date(b.creadoEn).getTime()
      );
  } finally {
    database.close();
  }
}

export async function actualizarPendiente(id, changes) {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORES.OUTBOX, "readwrite");
    const store = transaction.objectStore(STORES.OUTBOX);
    const current = await requestResult(store.get(String(id)));

    if (!current) return null;

    const updated = {
      ...current,
      ...changes,
      id: current.id,
      actualizadoEn: new Date().toISOString(),
    };

    store.put(updated);

    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);
    });

    window.dispatchEvent(new Event("operaciones-offline-actualizadas"));
    return updated;
  } finally {
    database.close();
  }
}

export async function eliminarPendiente(id) {
  await runTransaction(STORES.OUTBOX, "readwrite", (store) => {
    store.delete(String(id));
  });

  window.dispatchEvent(new Event("operaciones-offline-actualizadas"));
}

export function esErrorDeConexion(error) {
  if (!navigator.onLine) return true;

  const message = String(error?.message || "").toLowerCase();
  const status = Number(error?.status || error?.statusCode || 0);

  return (
    status === 0 ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("network request failed") ||
    message.includes("load failed") ||
    message.includes("fetch failed")
  );
}

export function limpiarDatosOffline() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) { resolve(); return; }
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Cierra otras pestañas de la aplicación e inténtalo nuevamente."));
  });
}
