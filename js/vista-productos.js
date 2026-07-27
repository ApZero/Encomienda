// vista-productos.js — productos individuales dentro de los lotes

const VistaProductos = {
  itemProductoEl(producto, itemCalc) {
    const li = el('li', { class: 'item-producto', onclick: () => navegar(`#/productos/${producto.id}`) });
    const img = producto.imagen
      ? el('img', { class: 'item-producto__img', src: producto.imagen, alt: '' })
      : el('div', { class: 'item-producto__img item-producto__img--vacia' }, '🏷️');
    li.appendChild(img);
    const cantidad = Math.max(1, Number(producto.cantidad) || 1);
    li.appendChild(el('div', { class: 'item__info' }, [
      el('div', { class: 'item__titulo' }, producto.nombre || 'Sin nombre'),
      el('div', { class: 'item__meta' }, [
        el('span', { class: 'etiqueta' }, producto.categoria || 'Sin categoría'),
        cantidad > 1 ? ` · ${cantidad}× ` : ' · ',
        estrellasTexto(producto.valio_la_pena)
      ])
    ]));
    li.appendChild(el('div', { class: 'item__precio mono' }, [
      formatoGs(itemCalc ? itemCalc.totalGs : 0),
      el('small', {}, cantidad > 1 && itemCalc ? `${formatoGs(itemCalc.totalUnitarioGs)} c/u` : formatoUsd(producto.precio_usd))
    ]));
    return li;
  },

  async _calcularTodosLosProductos() {
    const [lotes, productos] = await Promise.all([Lotes.todos(), Productos.todos()]);
    const productosPorLote = {};
    for (const p of productos) (productosPorLote[p.lote_id] = productosPorLote[p.lote_id] || []).push(p);
    const lotesById = {};
    const itemsPorProductoId = {};
    for (const lote of lotes) {
      lotesById[lote.id] = lote;
      const calc = calcularLote(lote, productosPorLote[lote.id] || []);
      lote._pesoTotalCalculado = calc.pesoTotal;
      lote._tasaCambioCalculada = calc.tasaCambio;
      for (const item of calc.items) itemsPorProductoId[item.producto.id] = item;
    }
    return { lotes, lotesById, productos, itemsPorProductoId };
  },

  async render(cont, params) {
    params = params || {};
    const { lotes, lotesById, productos, itemsPorProductoId } = await this._calcularTodosLosProductos();
    const categorias = await Meta.obtener('categorias', CATEGORIAS_DEFECTO);
    const tiendas = await Meta.obtener('tiendas', TIENDAS_DEFECTO);

    const estado = {
      texto: params.q || '',
      tienda: params.tienda || 'todas',
      categoria: params.categoria || 'todas',
      valio: params.valio || 'todas',
      orden: params.orden || 'fecha_desc'
    };

    cont.innerHTML = `
      <div class="vista-encabezado">
        <h2>Productos</h2>
        <button class="btn btn--principal btn--pequeno" id="btn-nuevo-producto">+ Agregar</button>
      </div>
      <div class="campo" style="margin-bottom:10px;">
        <input type="search" id="buscar-producto" placeholder="Buscar por nombre…" value="${estado.texto}">
      </div>
      <div class="filtros" id="filtros-tienda"></div>
      <div class="filtros" id="filtros-categoria"></div>
      <div class="filtros" id="filtros-valio"></div>
      <div class="selector-orden">
        <select id="selector-orden">
          <option value="fecha_desc">Más recientes primero</option>
          <option value="fecha_asc">Más antiguos primero</option>
          <option value="precio_desc">Precio (mayor a menor)</option>
          <option value="precio_asc">Precio (menor a mayor)</option>
          <option value="calidad_desc">Mejor calificados</option>
          <option value="valio_desc">Mejor "valió la pena"</option>
        </select>
      </div>
      <ul class="lista" id="lista-productos"></ul>
    `;
    cont.querySelector('#selector-orden').value = estado.orden;
    cont.querySelector('#btn-nuevo-producto').addEventListener('click', () => navegar('#/productos/nuevo'));

    const chipsTienda = cont.querySelector('#filtros-tienda');
    chipsTienda.appendChild(el('button', { class: 'chip' + (estado.tienda === 'todas' ? ' activo' : ''), 'data-v': 'todas' }, 'Todas las tiendas'));
    for (const t of tiendas) chipsTienda.appendChild(el('button', { class: 'chip' + (estado.tienda === t ? ' activo' : ''), 'data-v': t }, t));

    const chipsCategoria = cont.querySelector('#filtros-categoria');
    chipsCategoria.appendChild(el('button', { class: 'chip' + (estado.categoria === 'todas' ? ' activo' : ''), 'data-v': 'todas' }, 'Todas las categorías'));
    for (const c of categorias) chipsCategoria.appendChild(el('button', { class: 'chip' + (estado.categoria === c ? ' activo' : ''), 'data-v': c }, c));

    const chipsValio = cont.querySelector('#filtros-valio');
    [['todas', 'Todos'], ['vale', '★ Valió la pena'], ['trash', '🗑 Fue basura'], ['sin', 'Sin calificar']].forEach(([v, label]) => {
      chipsValio.appendChild(el('button', { class: 'chip' + (estado.valio === v ? ' activo' : ''), 'data-v': v }, label));
    });

    const pintarLista = () => {
      let lista = productos.filter(p => {
        if (estado.texto && !normalizar(p.nombre).includes(normalizar(estado.texto))) return false;
        if (estado.tienda !== 'todas') {
          const lote = lotesById[p.lote_id];
          if (!lote || lote.tienda !== estado.tienda) return false;
        }
        if (estado.categoria !== 'todas' && p.categoria !== estado.categoria) return false;
        if (estado.valio === 'vale' && !(p.valio_la_pena >= 4)) return false;
        if (estado.valio === 'trash' && !(p.valio_la_pena > 0 && p.valio_la_pena <= 2)) return false;
        if (estado.valio === 'sin' && p.valio_la_pena) return false;
        return true;
      });

      const loteFecha = (p) => (lotesById[p.lote_id] || {}).fecha || '';
      const totalDe = (p) => (itemsPorProductoId[p.id] || {}).totalGs || 0;
      switch (estado.orden) {
        case 'fecha_asc': lista.sort((a, b) => loteFecha(a).localeCompare(loteFecha(b))); break;
        case 'precio_desc': lista.sort((a, b) => totalDe(b) - totalDe(a)); break;
        case 'precio_asc': lista.sort((a, b) => totalDe(a) - totalDe(b)); break;
        case 'calidad_desc': lista.sort((a, b) => (b.calidad || 0) - (a.calidad || 0)); break;
        case 'valio_desc': lista.sort((a, b) => (b.valio_la_pena || 0) - (a.valio_la_pena || 0)); break;
        default: lista.sort((a, b) => loteFecha(b).localeCompare(loteFecha(a)));
      }

      const ul = cont.querySelector('#lista-productos');
      ul.innerHTML = '';
      if (!lista.length) {
        ul.outerHTML = `<div class="vacio"><div class="vacio__icono">🔍</div><h3>Sin resultados</h3><p>Probá cambiar los filtros o el término de búsqueda.</p></div>`;
        return;
      }
      for (const p of lista) ul.appendChild(this.itemProductoEl(p, itemsPorProductoId[p.id]));
    };

    cont.querySelector('#buscar-producto').addEventListener('input', debounce((e) => { estado.texto = e.target.value; pintarLista(); }, 200));
    cont.querySelector('#selector-orden').addEventListener('change', (e) => { estado.orden = e.target.value; pintarLista(); });
    [chipsTienda, chipsCategoria, chipsValio].forEach(grupo => {
      grupo.addEventListener('click', (e) => {
        const btn = e.target.closest('.chip'); if (!btn) return;
        grupo.querySelectorAll('.chip').forEach(c => c.classList.remove('activo'));
        btn.classList.add('activo');
        if (grupo === chipsTienda) estado.tienda = btn.dataset.v;
        if (grupo === chipsCategoria) estado.categoria = btn.dataset.v;
        if (grupo === chipsValio) estado.valio = btn.dataset.v;
        pintarLista();
      });
    });

    pintarLista();
  },

  async renderDetalle(cont, id) {
    const producto = await Productos.obtener(id);
    if (!producto) { cont.innerHTML = `<div class="vacio"><h3>Producto no encontrado</h3></div>`; return; }
    const lote = await Lotes.obtener(producto.lote_id);
    const productosDelLote = await Productos.porLote(producto.lote_id);
    const calc = calcularLote(lote, productosDelLote);
    const item = calc.items.find(i => i.producto.id === id);

    cont.innerHTML = `
      <div class="vista-encabezado">
        <h2>${producto.nombre}</h2>
        <button class="btn btn--fantasma btn--pequeno" id="btn-editar-producto">Editar</button>
      </div>
      ${producto.imagen ? `<img class="detalle-imagen" src="${producto.imagen}" alt="${producto.nombre}">` : ''}

      <div class="tarjeta">
        <div class="tarjeta__fila">
          <span class="etiqueta">${producto.categoria || 'Sin categoría'}</span>
          <span class="campo-ayuda">${lote ? `${lote.tienda} · ${formatoFecha(lote.fecha)}` : ''}</span>
        </div>
        <div style="display:flex; gap:18px; margin-top:12px;">
          <div><div class="campo-ayuda" style="margin-bottom:3px">Calidad</div>${estrellasTexto(producto.calidad)}</div>
          <div><div class="campo-ayuda" style="margin-bottom:3px">¿Valió la pena?</div>${estrellasTexto(producto.valio_la_pena)}</div>
        </div>
      </div>

      <div class="tarjeta">
        <div class="detalle-grid">
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoUsd(producto.precio_usd)}</div><div class="detalle-dato__etiqueta">Precio original</div></div>
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoPeso(producto.peso_g)}</div><div class="detalle-dato__etiqueta">Peso</div></div>
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoGs(item ? item.gsProducto : 0)}</div><div class="detalle-dato__etiqueta">Precio + impuestos (₲)</div></div>
          <div class="detalle-dato"><div class="detalle-dato__valor mono">${formatoGs(item ? item.senditGs : 0)}</div><div class="detalle-dato__etiqueta">Envío Sendit (₲)</div></div>
        </div>
        <div class="tarjeta__fila" style="margin-top:6px; padding-top:12px; border-top:1px solid var(--linea)">
          <strong>Costo total${item && item.cantidad > 1 ? ` (${item.cantidad} piezas)` : ''}</strong>
          <strong class="mono">${formatoGs(item ? item.totalGs : 0)}</strong>
        </div>
        ${item && item.cantidad > 1 ? `
        <div class="tarjeta__fila" style="margin-top:4px">
          <span class="campo-ayuda">Por pieza (${formatoUsd(item.precioUnitarioUsd)} · ${formatoPeso(item.pesoUnitarioG)})</span>
          <span class="mono">${formatoGs(item.totalUnitarioGs)}</span>
        </div>` : ''}
      </div>

      ${producto.notas ? `<div class="tarjeta"><p style="margin:0">${producto.notas}</p></div>` : ''}

      <button class="btn btn--principal" id="btn-comprar-de-nuevo" style="width:100%; margin-bottom:10px;">🔁 Planificar recompra</button>
      <button class="btn btn--fantasma" id="btn-eliminar-producto" style="width:100%; color:var(--rojo-trash); border-color:var(--rojo-trash)">Eliminar producto</button>
    `;

    cont.querySelector('#btn-editar-producto').addEventListener('click', () => navegar(`#/productos/${id}/editar`));
    cont.querySelector('#btn-comprar-de-nuevo').addEventListener('click', () => navegar(`#/planificador/${encodeURIComponent(producto.nombre_norm)}`));
    cont.querySelector('#btn-eliminar-producto').addEventListener('click', async () => {
      const ok = await confirmarAccion('¿Eliminar este producto del lote?');
      if (!ok) return;
      await Productos.eliminar(id);
      mostrarToast('Producto eliminado', 'exito');
      navegar(`#/lotes/${producto.lote_id}`);
    });
  },

  async renderForm(cont, params) {
    params = params || {};
    const editandoId = params.id;
    const producto = editandoId ? await Productos.obtener(editandoId) : {
      lote_id: params.lote || '', nombre: '', categoria: '', precio_usd: '', peso_g: '',
      calidad: 0, valio_la_pena: 0, notas: '', imagen: null
    };
    const categorias = await Meta.obtener('categorias', CATEGORIAS_DEFECTO);
    const lotes = (await Lotes.todos()).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
    const loteFijo = lotes.find(l => l.id === producto.lote_id);
    const todosProductos = await Productos.todos();
    const nombresPorNorm = {};
    for (const p of todosProductos) {
      if (p.id === editandoId) continue;
      if (!nombresPorNorm[p.nombre_norm]) nombresPorNorm[p.nombre_norm] = { nombre: p.nombre, veces: 0 };
      nombresPorNorm[p.nombre_norm].veces++;
    }
    const nombresConocidos = Object.entries(nombresPorNorm)
      .map(([norm, info]) => ({ norm, nombre: info.nombre, veces: info.veces }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    cont.innerHTML = `
      <div class="vista-encabezado"><h2>${editandoId ? 'Editar producto' : 'Nuevo producto'}</h2></div>
      <form id="form-producto">
        ${loteFijo
        ? `<p class="campo-ayuda">Lote: <strong>${loteFijo.tienda} · ${formatoFecha(loteFijo.fecha)}</strong></p>`
        : `<div class="campo"><label>Lote</label>
             <select name="lote_id" required>
               <option value="">Elegí un lote…</option>
               ${lotes.map(l => `<option value="${l.id}">${l.tienda} · ${formatoFecha(l.fecha)}</option>`).join('')}
             </select>
             <p class="campo-ayuda">¿Es una compra nueva? Primero <a href="#/lotes/nuevo">creá un lote</a>.</p>
           </div>`
      }
        <div class="campo autocompletar">
          <label>Nombre del producto</label>
          <input type="text" name="nombre" value="${producto.nombre || ''}" required autocomplete="off">
          <div class="autocompletar__lista" id="sugerencias-nombre"></div>
        </div>
        <div id="panel-historial"></div>

        <div class="campo-fila">
          <div class="campo">
            <label>Precio total (US$)</label>
            <input type="number" step="0.01" name="precio_usd" value="${producto.precio_usd || ''}" required>
          </div>
          <div class="campo">
            <label>Peso total (g)</label>
            <input type="number" step="1" name="peso_g" value="${producto.peso_g || ''}">
          </div>
        </div>
        <div class="campo">
          <label>Cantidad (piezas)</label>
          <input type="number" step="1" min="1" name="cantidad" value="${producto.cantidad || 1}">
          <p class="campo-ayuda" id="ayuda-unitario">Si compraste más de una pieza, el precio y el peso de arriba son del paquete completo — acá se calcula cuánto sale cada una.</p>
        </div>

        <div class="campo">
          <label>Categoría</label>
          <select name="categoria_select">
            <option value="">Sin categoría</option>
            ${categorias.map(c => `<option value="${c}" ${producto.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
            <option value="__nueva__">+ Otra categoría…</option>
          </select>
        </div>
        <div class="campo" id="campo-categoria-nueva" style="display:none">
          <label>Nueva categoría</label>
          <input type="text" name="categoria_nueva">
        </div>

        <div class="campo-fila">
          <div class="campo">
            <label>Calidad</label>
            <div id="estrellas-calidad"></div>
          </div>
          <div class="campo">
            <label>¿Valió la pena?</label>
            <div id="estrellas-valio"></div>
          </div>
        </div>

        <div class="campo">
          <label>Foto</label>
          <input type="file" name="imagen_archivo" accept="image/*">
          <img id="preview-imagen" src="${producto.imagen || ''}" style="${producto.imagen ? '' : 'display:none;'} max-width:140px; border-radius:10px; margin-top:8px;">
        </div>

        <div class="campo">
          <label>Notas</label>
          <textarea name="notas">${producto.notas || ''}</textarea>
        </div>

        <button type="submit" class="btn btn--principal" style="width:100%">Guardar producto</button>
      </form>
    `;

    const actualizarAyudaUnitario = () => {
      const precio = parseFloat(cont.querySelector('[name="precio_usd"]').value) || 0;
      const peso = parseFloat(cont.querySelector('[name="peso_g"]').value) || 0;
      const cant = Math.max(1, parseInt(cont.querySelector('[name="cantidad"]').value, 10) || 1);
      const ayuda = cont.querySelector('#ayuda-unitario');
      if (cant <= 1) {
        ayuda.textContent = 'Si compraste más de una pieza, el precio y el peso de arriba son del paquete completo — acá se calcula cuánto sale cada una.';
      } else {
        ayuda.textContent = `Cada pieza: ${formatoUsd(precio / cant)}${peso ? ' · ' + formatoPeso(peso / cant) : ''}`;
      }
    };
    ['precio_usd', 'peso_g', 'cantidad'].forEach(nombre =>
      cont.querySelector(`[name="${nombre}"]`).addEventListener('input', actualizarAyudaUnitario));
    actualizarAyudaUnitario();

    let calidad = producto.calidad || 0;
    let valio = producto.valio_la_pena || 0;
    let imagenBase64 = producto.imagen || null;

    const pintarEstrellas = () => {
      const contCalidad = cont.querySelector('#estrellas-calidad');
      contCalidad.innerHTML = '';
      contCalidad.appendChild(estrellas(calidad, 5, true, (v) => { calidad = v; pintarEstrellas(); }));
      const contValio = cont.querySelector('#estrellas-valio');
      contValio.innerHTML = '';
      contValio.appendChild(estrellas(valio, 5, true, (v) => { valio = v; pintarEstrellas(); }));
    };
    pintarEstrellas();

    const selectCategoria = cont.querySelector('[name="categoria_select"]');
    const campoNuevaCategoria = cont.querySelector('#campo-categoria-nueva');
    selectCategoria.addEventListener('change', () => {
      campoNuevaCategoria.style.display = selectCategoria.value === '__nueva__' ? 'block' : 'none';
    });

    cont.querySelector('[name="imagen_archivo"]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        imagenBase64 = await redimensionarImagen(file);
        const preview = cont.querySelector('#preview-imagen');
        preview.src = imagenBase64;
        preview.style.display = '';
      } catch (err) {
        mostrarToast('No se pudo procesar la imagen', 'error');
      }
    });

    // comparación de precios en vivo mientras se escribe el nombre
    const panelHistorial = cont.querySelector('#panel-historial');
    const nombreInput = cont.querySelector('[name="nombre"]');
    const listaSugerencias = cont.querySelector('#sugerencias-nombre');

    const pintarHistorial = async () => {
      const nombreNorm = normalizar(nombreInput.value);
      if (!nombreNorm) { panelHistorial.innerHTML = ''; return; }
      const previos = (await Productos.buscarPorNombre(nombreNorm)).filter(p => p.id !== editandoId);
      if (!previos.length) { panelHistorial.innerHTML = ''; return; }
      const lotesCache = {};
      let html = `<div class="tarjeta" style="background:var(--crema)"><strong style="font-size:0.85rem">Ya compraste esto antes:</strong>`;
      for (const p of previos.slice(0, 4)) {
        if (!lotesCache[p.lote_id]) lotesCache[p.lote_id] = await Lotes.obtener(p.lote_id);
        const l = lotesCache[p.lote_id];
        const cant = Math.max(1, Number(p.cantidad) || 1);
        const detalle = cant > 1 ? `${formatoUsd(p.precio_usd)} por ${cant} (${formatoUsd(p.precio_usd / cant)} c/u)` : formatoUsd(p.precio_usd);
        html += `<div class="tarjeta__fila" style="margin-top:6px"><span class="campo-ayuda">${formatoFecha(l && l.fecha)}</span><span class="mono">${detalle}</span></div>`;
      }
      html += `</div>`;
      panelHistorial.innerHTML = html;
    };

    const mostrarSugerencias = () => {
      const q = normalizar(nombreInput.value);
      if (!q) { listaSugerencias.style.display = 'none'; listaSugerencias.innerHTML = ''; return; }
      const coincidencias = nombresConocidos.filter(n => n.norm.includes(q) && n.norm !== q).slice(0, 6);
      if (!coincidencias.length) { listaSugerencias.style.display = 'none'; listaSugerencias.innerHTML = ''; return; }
      listaSugerencias.innerHTML = '';
      for (const n of coincidencias) {
        listaSugerencias.appendChild(el('div', {
          class: 'autocompletar__item',
          onmousedown: (e) => e.preventDefault(), // evita perder el foco antes del click
          onclick: () => {
            nombreInput.value = n.nombre;
            listaSugerencias.style.display = 'none';
            pintarHistorial();
          }
        }, [
          n.nombre,
          el('span', { class: 'campo-ayuda' }, `${n.veces}×`)
        ]));
      }
      listaSugerencias.style.display = 'block';
    };

    const historialDebounced = debounce(pintarHistorial, 300);
    nombreInput.addEventListener('input', () => { mostrarSugerencias(); historialDebounced(); });
    nombreInput.addEventListener('focus', mostrarSugerencias);
    nombreInput.addEventListener('blur', () => setTimeout(() => { listaSugerencias.style.display = 'none'; }, 120));
    pintarHistorial();

    cont.querySelector('#form-producto').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      let categoria = fd.get('categoria_select');
      if (categoria === '__nueva__') {
        categoria = (fd.get('categoria_nueva') || '').trim();
        if (categoria && !categorias.includes(categoria)) {
          categorias.push(categoria);
          await Meta.guardar('categorias', categorias);
        }
      }
      const loteId = loteFijo ? loteFijo.id : fd.get('lote_id');
      if (!loteId) { mostrarToast('Elegí un lote', 'error'); return; }

      const nuevoProducto = {
        id: editandoId,
        lote_id: loteId,
        nombre: fd.get('nombre').trim(),
        categoria,
        precio_usd: parseFloat(fd.get('precio_usd')) || 0,
        peso_g: parseFloat(fd.get('peso_g')) || 0,
        cantidad: Math.max(1, parseInt(fd.get('cantidad'), 10) || 1),
        calidad,
        valio_la_pena: valio,
        notas: fd.get('notas') || '',
        imagen: imagenBase64
      };
      const guardado = await Productos.guardar(nuevoProducto);
      mostrarToast(editandoId ? 'Producto actualizado' : 'Producto agregado', 'exito');
      navegar(`#/productos/${guardado.id}`);
    });
  }
};
