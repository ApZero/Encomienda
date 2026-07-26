// vista-comparar.js — comparar precios de recompras y planificar la próxima compra

const VistaComparar = {
  async _prepararLotes() {
    const [lotes, productos] = await Promise.all([Lotes.todos(), Productos.todos()]);
    const porLote = {};
    for (const p of productos) (porLote[p.lote_id] = porLote[p.lote_id] || []).push(p);
    for (const lote of lotes) {
      const calc = calcularLote(lote, porLote[lote.id] || []);
      lote._pesoTotalCalculado = calc.pesoTotal;
      lote._tasaCambioCalculada = calc.tasaCambio;
    }
    return { lotes, productos };
  },

  async render(cont) {
    cont.innerHTML = `
      <div class="vista-encabezado"><h2>Comparar precios</h2></div>
      <p class="subtitulo-explicativo">Buscá algo que compraste más de una vez para ver cómo cambió el precio.</p>
      <div class="campo"><input type="search" id="buscar-comparar" placeholder="Ej: cargador, tester de miel…" autocomplete="off"></div>
      <div id="resultados-comparar"></div>
    `;

    const { productos } = await this._prepararLotes();
    const input = cont.querySelector('#buscar-comparar');
    const resultados = cont.querySelector('#resultados-comparar');

    const pintar = () => {
      const q = normalizar(input.value);
      const grupos = {};
      for (const p of productos) {
        if (q && !p.nombre_norm.includes(q)) continue;
        (grupos[p.nombre_norm] = grupos[p.nombre_norm] || { nombre: p.nombre, items: [] }).items.push(p);
      }
      const listaGrupos = Object.values(grupos)
        .filter(g => q ? true : g.items.length > 1)
        .sort((a, b) => b.items.length - a.items.length);

      resultados.innerHTML = '';
      if (!listaGrupos.length) {
        resultados.innerHTML = `<div class="vacio"><div class="vacio__icono">📊</div><h3>${q ? 'Sin resultados' : 'Nada para comparar todavía'}</h3><p>${q ? 'Probá con otro término.' : 'Cuando compres el mismo producto más de una vez, va a aparecer acá.'}</p></div>`;
        return;
      }
      for (const g of listaGrupos) {
        const card = el('div', { class: 'tarjeta', style: 'cursor:pointer', onclick: () => navegar(`#/planificador/${encodeURIComponent(g.items[0].nombre_norm)}`) }, [
          el('div', { class: 'tarjeta__fila' }, [
            el('strong', {}, g.nombre),
            el('span', { class: 'etiqueta' }, `${g.items.length}×`)
          ])
        ]);
        resultados.appendChild(card);
      }
    };
    input.addEventListener('input', debounce(pintar, 200));
    pintar();
  },

  async renderPlanificador(cont, nombreNorm) {
    if (!nombreNorm) { navegar('#/comparar'); return; }
    const { lotes } = await this._prepararLotes();
    const historial = await Productos.buscarPorNombre(nombreNorm);
    const lotesById = {};
    for (const l of lotes) lotesById[l.id] = l;

    const conFecha = await Promise.all(historial.map(async p => ({ producto: p, lote: lotesById[p.lote_id] })));
    conFecha.sort((a, b) => (a.lote?.fecha || '').localeCompare(b.lote?.fecha || ''));

    const nombreOriginal = historial[0]?.nombre || decodeURIComponent(nombreNorm);
    const maxPrecio = Math.max(1, ...conFecha.map(c => c.producto.precio_usd || 0));
    const ultimo = conFecha[conFecha.length - 1];

    const tasaCambioProm = tasaCambioPromedio(lotes) || 7500;
    const tasaSenditProm = tasaSenditPromedio(lotes) || 0;

    cont.innerHTML = `
      <div class="vista-encabezado"><h2>Planificar: ${nombreOriginal}</h2></div>

      <div class="seccion-titulo"><span>Historial de precios</span></div>
      <div class="tarjeta" id="historial-precios"></div>

      <div class="seccion-titulo"><span>Estimar próxima compra</span></div>
      <div class="tarjeta">
        <div class="campo-fila">
          <div class="campo">
            <label>Precio estimado (US$)</label>
            <input type="number" step="0.01" id="plan-precio" value="${ultimo ? ultimo.producto.precio_usd : ''}">
          </div>
          <div class="campo">
            <label>Peso estimado (g)</label>
            <input type="number" step="1" id="plan-peso" value="${ultimo ? ultimo.producto.peso_g : ''}">
          </div>
        </div>
        <div class="campo-fila">
          <div class="campo">
            <label>Cambio estimado (Gs/US$)</label>
            <input type="number" step="1" id="plan-cambio" value="${Math.round(tasaCambioProm)}">
          </div>
          <div class="campo">
            <label>Sendit estimado (Gs/g)</label>
            <input type="number" step="0.1" id="plan-sendit" value="${tasaSenditProm.toFixed(2)}">
          </div>
        </div>
        <p class="campo-ayuda">El cambio y el Sendit se pre-cargan con el promedio histórico de tus lotes. Ajustalos si tenés una estimación mejor.</p>
        <div class="tarjeta__fila" style="margin-top:10px; padding-top:12px; border-top:1px solid var(--linea)">
          <strong>Costo total estimado</strong>
          <strong class="mono" id="plan-resultado">₲ 0</strong>
        </div>
      </div>
    `;

    const histCont = cont.querySelector('#historial-precios');
    if (!conFecha.length) {
      histCont.outerHTML = `<p class="campo-ayuda">Todavía no compraste este producto antes.</p>`;
    } else {
      for (const c of conFecha) {
        const pct = Math.max(6, ((c.producto.precio_usd || 0) / maxPrecio) * 100);
        histCont.appendChild(el('div', { class: 'historial-precio' }, [
          el('span', { class: 'historial-precio__fecha' }, formatoFecha(c.lote?.fecha)),
          el('div', { class: 'historial-precio__barra' }, [el('div', { class: 'historial-precio__barra-interna', style: `width:${pct}%` })]),
          el('span', { class: 'historial-precio__valor' }, formatoUsd(c.producto.precio_usd))
        ]));
      }
    }

    const recalcular = () => {
      const precio = parseFloat(cont.querySelector('#plan-precio').value) || 0;
      const peso = parseFloat(cont.querySelector('#plan-peso').value) || 0;
      const cambio = parseFloat(cont.querySelector('#plan-cambio').value) || 0;
      const sendit = parseFloat(cont.querySelector('#plan-sendit').value) || 0;
      const totalGs = precio * cambio + peso * sendit;
      cont.querySelector('#plan-resultado').textContent = formatoGs(totalGs);
    };
    ['plan-precio', 'plan-peso', 'plan-cambio', 'plan-sendit'].forEach(idc =>
      cont.querySelector('#' + idc).addEventListener('input', recalcular));
    recalcular();
  }
};
