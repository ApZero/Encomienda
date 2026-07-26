// vista-dashboard.js — resumen general "Hoy"

const VistaDashboard = {
  async render(cont) {
    cont.innerHTML = `<p class="subtitulo-explicativo">Cargando resumen…</p>`;
    const [lotes, productos] = await Promise.all([Lotes.todos(), Productos.todos()]);

    const productosPorLote = {};
    for (const p of productos) {
      (productosPorLote[p.lote_id] = productosPorLote[p.lote_id] || []).push(p);
    }

    let totalGeneralGs = 0, totalVale = 0, totalTrash = 0, totalNeutro = 0;
    let gsEsteMes = 0, gsEsteAno = 0;
    const ahora = new Date();
    const mesActual = ahora.toISOString().slice(0, 7);
    const anoActual = ahora.getFullYear().toString();

    for (const lote of lotes) {
      const props = productosPorLote[lote.id] || [];
      const calc = calcularLote(lote, props);
      lote._pesoTotalCalculado = calc.pesoTotal;
      lote._tasaCambioCalculada = calc.tasaCambio;
      totalGeneralGs += calc.totalGeneralGs;
      const esMes = (lote.fecha || '').slice(0, 7) === mesActual;
      const esAno = (lote.fecha || '').slice(0, 4) === anoActual;
      if (esMes) gsEsteMes += calc.totalGeneralGs;
      if (esAno) gsEsteAno += calc.totalGeneralGs;

      for (const item of calc.items) {
        const v = item.producto.valio_la_pena || 0;
        if (v >= 4) totalVale += item.totalGs;
        else if (v > 0 && v <= 2) totalTrash += item.totalGs;
        else totalNeutro += item.totalGs;
      }
    }

    const ultimosLotes = [...lotes].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 4);

    cont.innerHTML = `
      <div class="stat-grid">
        <div class="stat">
          <div class="stat__valor mono">${formatoGs(totalGeneralGs)}</div>
          <div class="stat__etiqueta">Gastado en total</div>
        </div>
        <div class="stat">
          <div class="stat__valor mono">${formatoGs(gsEsteMes)}</div>
          <div class="stat__etiqueta">Este mes</div>
        </div>
        <div class="stat stat--vale">
          <div class="stat__valor mono">${formatoGs(totalVale)}</div>
          <div class="stat__etiqueta">Valió la pena</div>
        </div>
        <div class="stat stat--trash">
          <div class="stat__valor mono">${formatoGs(totalTrash)}</div>
          <div class="stat__etiqueta">Fue basura</div>
        </div>
      </div>

      <div class="tarjeta" style="display:flex; justify-content:space-around; text-align:center;">
        <div><div class="stat__valor mono" style="font-size:1.1rem">${lotes.length}</div><div class="stat__etiqueta">Lotes</div></div>
        <div><div class="stat__valor mono" style="font-size:1.1rem">${productos.length}</div><div class="stat__etiqueta">Productos</div></div>
        <div><div class="stat__valor mono" style="font-size:1.1rem">${formatoGs(gsEsteAno)}</div><div class="stat__etiqueta">Este año</div></div>
      </div>

      <div class="seccion-titulo">
        <span>Últimos lotes</span>
        <button class="btn btn--fantasma btn--pequeno" data-ir="#/lotes">Ver todos</button>
      </div>
      <ul class="lista" id="lista-ultimos-lotes"></ul>
    `;

    const lista = cont.querySelector('#lista-ultimos-lotes');
    if (!ultimosLotes.length) {
      lista.outerHTML = `<div class="vacio"><div class="vacio__icono">📦</div><h3>Todavía no hay compras</h3><p>Registrá tu primer lote para empezar a llevar la cuenta.</p></div>`;
    } else {
      for (const lote of ultimosLotes) {
        const calc = calcularLote(lote, productosPorLote[lote.id] || []);
        lista.appendChild(VistaLotes.itemLoteEl(lote, productosPorLote[lote.id] || [], calc));
      }
    }

    cont.querySelector('[data-ir]')?.addEventListener('click', (e) => navegar(e.target.dataset.ir.slice(1)));
  }
};
