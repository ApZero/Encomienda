// db.js — capa de datos con IndexedDB
const DB_NAME = 'EncomiendaDB';
const DB_VERSION = 1;
let _db = null;

function abrirDB() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('lotes')) {
        db.createObjectStore('lotes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('productos')) {
        const store = db.createObjectStore('productos', { keyPath: 'id' });
        store.createIndex('lote_id', 'lote_id', { unique: false });
        store.createIndex('nombre_norm', 'nombre_norm', { unique: false });
        store.createIndex('categoria', 'categoria', { unique: false });
        store.createIndex('tienda', 'tienda', { unique: false });
      }
      if (!db.objectStoreNames.contains('meta')) {
        db.createObjectStore('meta', { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains('backups')) {
        db.createObjectStore('backups', { keyPath: 'id' });
      }
    };
    req.onsuccess = (e) => { _db = e.target.result; resolve(_db); };
    req.onerror = (e) => reject(e.target.error);
  });
}

function tx(storeName, mode = 'readonly') {
  return abrirDB().then(db => db.transaction(storeName, mode).objectStore(storeName));
}

function reqToPromise(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

function normalizar(texto) {
  return (texto || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// ---- Lotes ----
const Lotes = {
  async todos() {
    const store = await tx('lotes');
    return reqToPromise(store.getAll());
  },
  async obtener(id) {
    const store = await tx('lotes');
    return reqToPromise(store.get(id));
  },
  async guardar(lote) {
    if (!lote.id) lote.id = uid();
    const store = await tx('lotes', 'readwrite');
    await reqToPromise(store.put(lote));
    return lote;
  },
  async eliminar(id) {
    const store = await tx('lotes', 'readwrite');
    return reqToPromise(store.delete(id));
  }
};

// ---- Productos ----
const Productos = {
  async todos() {
    const store = await tx('productos');
    return reqToPromise(store.getAll());
  },
  async porLote(loteId) {
    const store = await tx('productos');
    const idx = store.index('lote_id');
    return reqToPromise(idx.getAll(loteId));
  },
  async obtener(id) {
    const store = await tx('productos');
    return reqToPromise(store.get(id));
  },
  async guardar(prod) {
    if (!prod.id) prod.id = uid();
    prod.nombre_norm = normalizar(prod.nombre);
    const store = await tx('productos', 'readwrite');
    await reqToPromise(store.put(prod));
    return prod;
  },
  async eliminar(id) {
    const store = await tx('productos', 'readwrite');
    return reqToPromise(store.delete(id));
  },
  async eliminarPorLote(loteId) {
    const productos = await this.porLote(loteId);
    const store = await tx('productos', 'readwrite');
    for (const p of productos) await reqToPromise(store.delete(p.id));
  },
  async buscarPorNombre(nombreNorm) {
    const store = await tx('productos');
    const idx = store.index('nombre_norm');
    return reqToPromise(idx.getAll(nombreNorm));
  }
};

// ---- Meta (categorías, tiendas, config) ----
const Meta = {
  async obtener(key, porDefecto) {
    const store = await tx('meta');
    const r = await reqToPromise(store.get(key));
    return r ? r.value : porDefecto;
  },
  async guardar(key, value) {
    const store = await tx('meta', 'readwrite');
    return reqToPromise(store.put({ key, value }));
  }
};

// ---- Backups ----
const Backups = {
  async listar() {
    const store = await tx('backups');
    const all = await reqToPromise(store.getAll());
    return all.sort((a, b) => b.timestamp - a.timestamp);
  },
  async guardar(id, data) {
    const store = await tx('backups', 'readwrite');
    return reqToPromise(store.put({ id, data, timestamp: Date.now() }));
  },
  async obtener(id) {
    const store = await tx('backups');
    return reqToPromise(store.get(id));
  },
  async eliminar(id) {
    const store = await tx('backups', 'readwrite');
    return reqToPromise(store.delete(id));
  }
};

const CATEGORIAS_DEFECTO = ['Electrónica', 'Hogar', 'Ropa', 'Herramientas', 'Apicultura', 'Jardín', 'Cocina', 'Repuestos', 'Otros'];
const TIENDAS_DEFECTO = ['AliExpress', 'eBay'];
