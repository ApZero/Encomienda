// vista-lotes.js — lotes de compra (grupos de productos comprados juntos)

const VistaLotes = {
  itemLoteEl(lote, productos, calc) {
    const li = el('li', { class: 'item-lote', onclick: () => navegar(`#/lotes/${lote.id}`) });
    const tiendaClase = (lote.tienda || '').toLowerCase().includes('ebay') ? 'etiqueta--tienda-ebay' : '';
    li.appendChild(el('div', { class: 'item__info' }, [
      el('div', { class: 'item__titulo' }, `${lote.tienda || 'Sin tienda'} · ${productos.length} producto${productos.length === 1 ? '' : 's'}`),
      el('div', { class: 'item__meta' }, [
        el('span', { class: `etiqueta ${tiendaClase}` }, formatoFecha(lote.fecha)),
        ' · ',
        formatoPeso(calc.pesoTotal)
      ])
    ]));
    li.appendChild(el('div', { class: 'item__precio mono' }, [
      formatoGs(calc.totalGeneralGs),
      el('small', {}, `cambio ${calc.tasaCambio ? calc.tasaCambio.toFixed(0) : '—'} Gs/$`)
    ]));
    return li;
  },

  async render(cont) {
    const [lotes, productos] = await Promise.all([Lotes.todos(), Productos.todos()]);
    const productosPorLote = {};
    for (const p of productos) (productosPorLote[p.lote_id] = productosPorLote[p.lote_id] || []).push(p);

    cont.innerHTML = `
      <div class="vista-encabezado">
        <h2>Lotes</h2>
        <button class="btn btn--principal btn--pequeno" id="btn-nuevo-lote">+ Nuevo lote</button>
      </div>
      <ul class="lista" id="lista-lotes"></ul>
    `;
    cont.querySelector('#btn-nuevo-lote').addEventListener('click', () => navegar('#/lotes/nuevo'));

    const lista = cont.querySelector('#lista-lotes');
    const ordenados = [...lotes].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    if (!ordenados.length) {
      lista.outerHTML = `<div class="vacio"><div class="vacio__icono">📦</div><h3>Sin lotes todavía</h3><p>Un lote agrupa todo lo que comprás de una vez: varios productos, un pago y un envío.</p></div>`;
      return;
    }
    for (const lote of ordenados) {
      const props = productosPorLote[lote.id] || [];
      const calc = calcularLote(lote, props);
      lista.appendChild(this.itemLoteEl(lote, props, calc));
    }
  },

  async renderDetalle(cont, id) {
    const lote = await Lotes.obtener(id);
    if (!lote) { cont.innerHTML = `<div class="vacio"><h3>Lote no encontrado</h3></div>`; return; }
    const productos = await Productos.porLote(id);
    const calc = calcularLote(lote, productos);

    cont.innerHTML = `
      <div class="vista-encabezado">
        <h2>${lote.tienda || 'Lote'} · ${formatoFecha(lote.fecha)}</h2>
        <div style="display:flex; gap:6px;">
          <button class="btn btn--fantasma btn--pequeno" id="btn-editar-lote">Editar</button>
        </div>
      </div>

      <div class="tarjeta">
        <div class="detalle-grid">
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoUsd(calc.totalUsd)}</div><div class="detalle-dato__etiqueta">Total en USD</div></div>
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${calc.tasaCambio ? calc.tasaCambio.toLocaleString('es-PY', {maximumFractionDigits:0}) : '—'} Gs/$</div><div class="detalle-dato__etiqueta">Cambio usado</div></div>
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoGs(lote.monto_pagado_gs)}</div><div class="detalle-dato__etiqueta">Pagado (compra)</div></div>
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoGs(lote.sendit_pagado_gs)}</div><div class="detalle-dato__etiqueta">Pagado a Sendit</div></div>
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoPeso(calc.pesoTotal)}</div><div class="detalle-dato__etiqueta">Peso total (+ embalaje)</div></div>
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoGs(calc.totalGeneralGs)}</div><div class="detalle-dato__etiqueta">Costo total del lote</div></div>
        </div>
        ${lote.notas ? `<p class="campo-ayuda">${lote.notas}</p>` : ''}
      </div>

      <div class="seccion-titulo">
        <span>Productos (${productos.length})</span>
        <button class="btn btn--principal btn--pequeno" id="btn-agregar-producto">+ Agregar</button>
      </div>
      <ul class="lista" id="lista-productos-lote"></ul>

      <button class="btn btn--fantasma" id="btn-eliminar-lote" style="margin-top:20px; width:100%; color:var(--rojo-trash); border-color:var(--rojo-trash)">Eliminar este lote</button>
    `;

    cont.querySelector('#btn-editar-lote').addEventListener('click', () => navegar(`#/lotes/nuevo?editar=${id}`));
    cont.querySelector('#btn-agregar-producto').addEventListener('click', () => navegar(`#/productos/nuevo?lote=${id}`));
    cont.querySelector('#btn-eliminar-lote').addEventListener('click', async () => {
      const ok = await confirmarAccion(`¿Eliminar este lote y sus ${productos.length} producto(s)? Esta acción no se puede deshacer.`);
      if (!ok) return;
      await Productos.eliminarPorLote(id);
      await Lotes.eliminar(id);
      mostrarToast('Lote eliminado', 'exito');
      navegar('#/lotes');
    });

    const lista = cont.querySelector('#lista-productos-lote');
    if (!productos.length) {
      lista.outerHTML = `<div class="vacio"><div class="vacio__icono">🏷️</div><h3>Sin productos</h3><p>Agregá los productos que compraste en este lote.</p></div>`;
      return;
    }
    for (const item of calc.items) {
      lista.appendChild(VistaProductos.itemProductoEl(item.producto, item));
    }
  },

  async renderForm(cont, params) {
    params = params || {};
    const editandoId = params.editar;
    const lote = editandoId ? await Lotes.obtener(editandoId) : {
      fecha: new Date().toISOString().slice(0, 10),
      tienda: '', impuestos_usd: '', envio_intl_usd: '', monto_pagado_gs: '', sendit_pagado_gs: '', peso_embalaje_g: '', notas: ''
    };
    const tiendas = await Meta.obtener('tiendas', TIENDAS_DEFECTO);

    cont.innerHTML = `
      <div class="vista-encabezado"><h2>${editandoId ? 'Editar lote' : 'Nuevo lote'}</h2></div>
      <form id="form-lote">
        <div class="campo-fila">
          <div class="campo">
            <label>Fecha</label>
            <input type="date" name="fecha" value="${lote.fecha || ''}" required>
          </div>
          <div class="campo">
            <label>Tienda</label>
            <select name="tienda_select">
              ${tiendas.map(t => `<option value="${t}" ${lote.tienda === t ? 'selected' : ''}>${t}</option>`).join('')}
              <option value="__nueva__">+ Otra tienda…</option>
            </select>
          </div>
        </div>
        <div class="campo" id="campo-tienda-nueva" style="display:none">
          <label>Nombre de la nueva tienda</label>
          <input type="text" name="tienda_nueva" placeholder="Ej: Amazon">
        </div>

        <fieldset class="grupo">
          <legend>Pago (en guaraníes)</legend>
          <div class="campo">
            <label>Monto pagado por todo el lote (₲)</label>
            <input type="number" step="1" name="monto_pagado_gs" value="${lote.monto_pagado_gs || ''}" placeholder="Ej: 850000">
            <p class="campo-ayuda">Lo que realmente pagaste en guaraníes por la compra (sin Sendit). Con esto se calcula el cambio usado.</p>
          </div>
          <div class="campo-fila">
            <div class="campo">
              <label>Impuestos (US$)</label>
              <input type="number" step="0.01" name="impuestos_usd" value="${lote.impuestos_usd || ''}" placeholder="0.00">
            </div>
            <div class="campo">
              <label>Envío internacional (US$)</label>
              <input type="number" step="0.01" name="envio_intl_usd" value="${lote.envio_intl_usd || ''}" placeholder="0.00">
            </div>
          </div>
        </fieldset>

        <fieldset class="grupo">
          <legend>Sendit</legend>
          <div class="campo-fila">
            <div class="campo">
              <label>Pagado a Sendit (₲)</label>
              <input type="number" step="1" name="sendit_pagado_gs" value="${lote.sendit_pagado_gs || ''}" placeholder="Ej: 60000">
            </div>
            <div class="campo">
              <label>Peso del embalaje (g)</label>
              <input type="number" step="1" name="peso_embalaje_g" value="${lote.peso_embalaje_g || ''}" placeholder="0">
            </div>
          </div>
          <p class="campo-ayuda">El costo de Sendit se reparte entre los productos según su peso individual + el embalaje.</p>
        </fieldset>

        <div class="campo">
          <label>Notas</label>
          <textarea name="notas">${lote.notas || ''}</textarea>
        </div>

        <button type="submit" class="btn btn--principal" style="width:100%">Guardar lote</button>
      </form>
    `;

    const select = cont.querySelector('[name="tienda_select"]');
    const campoNueva = cont.querySelector('#campo-tienda-nueva');
    select.addEventListener('change', () => { campoNueva.style.display = select.value === '__nueva__' ? 'block' : 'none'; });

    cont.querySelector('#form-lote').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      let tienda = fd.get('tienda_select');
      if (tienda === '__nueva__') {
        tienda = (fd.get('tienda_nueva') || '').trim();
        if (tienda && !tiendas.includes(tienda)) {
          tiendas.push(tienda);
          await Meta.guardar('tiendas', tiendas);
        }
      }
      const nuevoLote = {
        id: editandoId,
        fecha: fd.get('fecha'),
        tienda,
        impuestos_usd: parseFloat(fd.get('impuestos_usd')) || 0,
        envio_intl_usd: parseFloat(fd.get('envio_intl_usd')) || 0,
        monto_pagado_gs: parseFloat(fd.get('monto_pagado_gs')) || 0,
        sendit_pagado_gs: parseFloat(fd.get('sendit_pagado_gs')) || 0,
        peso_embalaje_g: parseFloat(fd.get('peso_embalaje_g')) || 0,
        notas: fd.get('notas') || ''
      };
      const guardado = await Lotes.guardar(nuevoLote);
      mostrarToast(editandoId ? 'Lote actualizado' : 'Lote creado', 'exito');
      navegar(`#/lotes/${guardado.id}`);
    });
  }
};
