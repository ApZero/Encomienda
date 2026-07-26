// app.js — enrutador principal e inicialización

const Rutas = {
  dashboard: (params, cont) => VistaDashboard.render(cont),
  lotes: (params, cont) => VistaLotes.render(cont, params),
  'lotes-detalle': (params, cont) => VistaLotes.renderDetalle(cont, params.id),
  'lotes-form': (params, cont) => VistaLotes.renderForm(cont, params),
  productos: (params, cont) => VistaProductos.render(cont, params),
  'productos-detalle': (params, cont) => VistaProductos.renderDetalle(cont, params.id),
  'productos-form': (params, cont) => VistaProductos.renderForm(cont, params),
  comparar: (params, cont) => VistaComparar.render(cont, params),
  planificador: (params, cont) => VistaComparar.renderPlanificador(cont, params.nombre),
  ajustes: (params, cont) => VistaAjustes.render(cont)
};

const TAB_POR_VISTA = {
  dashboard: 'dashboard',
  lotes: 'lotes', 'lotes-detalle': 'lotes', 'lotes-form': 'lotes',
  productos: 'productos', 'productos-detalle': 'productos', 'productos-form': 'productos',
  comparar: 'comparar', planificador: 'comparar',
  ajustes: 'ajustes'
};

function parsearHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [ruta, queryStr] = hash.split('?');
  const partes = ruta.split('/').filter(Boolean);
  const params = {};
  if (queryStr) {
    for (const par of queryStr.split('&')) {
      const [k, v] = par.split('=');
      params[k] = decodeURIComponent(v || '');
    }
  }
  if (!partes.length) return { vista: 'dashboard', params };

  if (partes[0] === 'lotes') {
    if (partes[1] === 'nuevo') return { vista: 'lotes-form', params };
    if (partes[1]) return { vista: 'lotes-detalle', params: { ...params, id: partes[1] } };
    return { vista: 'lotes', params };
  }
  if (partes[0] === 'productos') {
    if (partes[1] === 'nuevo') return { vista: 'productos-form', params };
    if (partes[1] && partes[2] === 'editar') return { vista: 'productos-form', params: { ...params, id: partes[1] } };
    if (partes[1]) return { vista: 'productos-detalle', params: { ...params, id: partes[1] } };
    return { vista: 'productos', params };
  }
  if (partes[0] === 'planificador') return { vista: 'planificador', params: { ...params, nombre: decodeURIComponent(partes[1] || '') } };
  return { vista: partes[0] || 'dashboard', params };
}

function navegar(hash) {
  location.hash = hash;
}

async function enrutar() {
  const { vista, params } = parsearHash();
  const cont = document.getElementById('vista');
  const fn = Rutas[vista] || Rutas.dashboard;
  document.querySelectorAll('.nav-inferior__item').forEach(b => {
    b.classList.toggle('activo', b.dataset.vista === (TAB_POR_VISTA[vista] || vista));
  });
  cont.scrollTop = 0;
  window.scrollTo(0, 0);
  try {
    await fn(params, cont);
  } catch (e) {
    console.error(e);
    cont.innerHTML = `<div class="vacio"><div class="vacio__icono">⚠️</div><h3>Ocurrió un error</h3><p>${e.message}</p></div>`;
  }
}

function mostrarFechaHoy() {
  const el = document.getElementById('fecha-hoy');
  const hoy = new Date();
  el.textContent = hoy.toLocaleDateString('es-PY', { day: 'numeric', month: 'short' });
}

async function iniciar() {
  mostrarFechaHoy();
  window.addEventListener('hashchange', enrutar);
  document.querySelectorAll('.nav-inferior__item').forEach(btn => {
    btn.addEventListener('click', () => navegar('#/' + btn.dataset.vista));
  });

  // categorías y tiendas por defecto si es la primera vez
  const categorias = await Meta.obtener('categorias', null);
  if (!categorias) await Meta.guardar('categorias', CATEGORIAS_DEFECTO);
  const tiendas = await Meta.obtener('tiendas', null);
  if (!tiendas) await Meta.guardar('tiendas', TIENDAS_DEFECTO);

  await verificarRespaldoDiario().catch(err => console.warn('Respaldo diario falló', err));

  await enrutar();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(err => console.warn('SW no registrado', err));
  }
}

document.addEventListener('DOMContentLoaded', iniciar);
