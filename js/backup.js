// backup.js — respaldo diario automático + exportación/importación manual
const MAX_BACKUPS_AUTO = 30;

async function exportarTodo() {
  const [lotes, productos, categorias, tiendas] = await Promise.all([
    Lotes.todos(),
    Productos.todos(),
    Meta.obtener('categorias', CATEGORIAS_DEFECTO),
    Meta.obtener('tiendas', TIENDAS_DEFECTO)
  ]);
  return {
    version: 1,
    exportado: new Date().toISOString(),
    lotes, productos, categorias, tiendas
  };
}

async function importarTodo(datos, { modo = 'reemplazar' } = {}) {
  if (!datos || !Array.isArray(datos.lotes) || !Array.isArray(datos.productos)) {
    throw new Error('El archivo no tiene el formato esperado de Encomienda.');
  }
  if (modo === 'reemplazar') {
    const db = await abrirDB();
    await Promise.all(['lotes', 'productos'].map(nombre => new Promise((resolve, reject) => {
      const req = db.transaction(nombre, 'readwrite').objectStore(nombre).clear();
      req.onsuccess = resolve; req.onerror = () => reject(req.error);
    })));
  }
  for (const lote of datos.lotes) await Lotes.guardar(lote);
  for (const prod of datos.productos) await Productos.guardar(prod);
  if (datos.categorias) await Meta.guardar('categorias', datos.categorias);
  if (datos.tiendas) await Meta.guardar('tiendas', datos.tiendas);
}

// Se llama una vez al iniciar la app: si todavía no hay respaldo de hoy, lo crea.
async function verificarRespaldoDiario() {
  const hoy = new Date().toISOString().slice(0, 10);
  const ultimo = await Meta.obtener('ultimoRespaldo', null);
  if (ultimo === hoy) return;
  const datos = await exportarTodo();
  // no respaldar si no hay nada todavía
  if (datos.lotes.length === 0 && datos.productos.length === 0) return;
  await Backups.guardar(hoy, datos);
  await Meta.guardar('ultimoRespaldo', hoy);
  // podar respaldos viejos
  const lista = await Backups.listar();
  if (lista.length > MAX_BACKUPS_AUTO) {
    const sobrantes = lista.slice(MAX_BACKUPS_AUTO);
    for (const b of sobrantes) await Backups.eliminar(b.id);
  }
}

function descargarBackup() {
  exportarTodo().then(datos => {
    const blob = new Blob([JSON.stringify(datos, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `encomienda-respaldo-${fecha}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
}

function cargarArchivoBackup(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result)); }
      catch (e) { reject(new Error('No se pudo leer el archivo. ¿Es un JSON válido?')); }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
