// vista-ajustes.js — categorías, tiendas y respaldos

const VistaAjustes = {
  async render(cont) {
    const categorias = await Meta.obtener('categorias', CATEGORIAS_DEFECTO);
    const tiendas = await Meta.obtener('tiendas', TIENDAS_DEFECTO);
    const backups = await Backups.listar();

    cont.innerHTML = `
      <div class="vista-encabezado"><h2>Ajustes</h2></div>

      <div class="seccion-titulo"><span>Respaldo</span></div>
      <div class="tarjeta">
        <p class="campo-ayuda" style="margin-top:0">Cada día que abrís la app se guarda automáticamente una copia de tus datos (hasta 30 días de historial). También podés descargar o restaurar un respaldo manualmente.</p>
        <button class="btn btn--principal btn--pequeno" id="btn-descargar" style="margin-right:8px">⬇ Descargar respaldo</button>
        <button class="btn btn--fantasma btn--pequeno" id="btn-importar">⬆ Importar archivo</button>
      </div>

      <div class="seccion-titulo"><span>Respaldos automáticos (${backups.length})</span></div>
      <div class="tarjeta" id="lista-backups">
        ${backups.length ? '' : '<p class="campo-ayuda" style="margin:0">Todavía no hay respaldos automáticos. Se crea uno la primera vez que uses la app cada día.</p>'}
      </div>

      <div class="seccion-titulo"><span>Tiendas</span></div>
      <div class="tarjeta">
        <div class="filtros" id="chips-tiendas" style="flex-wrap:wrap; overflow:visible;"></div>
        <div class="campo-fila" style="margin-top:10px">
          <div class="campo"><input type="text" id="nueva-tienda" placeholder="Nueva tienda"></div>
          <button class="btn btn--fantasma btn--pequeno" id="btn-agregar-tienda">Agregar</button>
        </div>
      </div>

      <div class="seccion-titulo"><span>Categorías</span></div>
      <div class="tarjeta">
        <div class="filtros" id="chips-categorias" style="flex-wrap:wrap; overflow:visible;"></div>
        <div class="campo-fila" style="margin-top:10px">
          <div class="campo"><input type="text" id="nueva-categoria" placeholder="Nueva categoría"></div>
          <button class="btn btn--fantasma btn--pequeno" id="btn-agregar-categoria">Agregar</button>
        </div>
      </div>

      <p class="campo-ayuda" style="text-align:center; margin-top:24px;">Encomienda · registro personal de compras online</p>
    `;

    const listaBackups = cont.querySelector('#lista-backups');
    for (const b of backups) {
      const item = el('div', { class: 'backup-item' }, [
        el('span', {}, `${b.id} · ${b.data.lotes.length} lotes, ${b.data.productos.length} productos`),
        el('button', {
          class: 'btn btn--fantasma btn--pequeno', onclick: async () => {
            const ok = await confirmarAccion(`¿Restaurar el respaldo del ${b.id}? Se reemplazarán todos los datos actuales.`);
            if (!ok) return;
            await importarTodo(b.data, { modo: 'reemplazar' });
            mostrarToast('Respaldo restaurado', 'exito');
            navegar('#/dashboard');
          }
        }, 'Restaurar')
      ]);
      listaBackups.appendChild(item);
    }

    cont.querySelector('#btn-descargar').addEventListener('click', () => { descargarBackup(); mostrarToast('Descargando respaldo…'); });
    cont.querySelector('#btn-importar').addEventListener('click', () => {
      const input = document.getElementById('input-importar-archivo');
      input.value = '';
      input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;
        try {
          const datos = await cargarArchivoBackup(file);
          const ok = await confirmarAccion('¿Importar este archivo? Se reemplazarán todos los datos actuales por los del archivo.');
          if (!ok) return;
          await importarTodo(datos, { modo: 'reemplazar' });
          mostrarToast('Datos importados correctamente', 'exito');
          navegar('#/dashboard');
        } catch (err) {
          mostrarToast(err.message, 'error');
        }
      };
      input.click();
    });

    const pintarChips = (contenedor, lista, key) => {
      contenedor.innerHTML = '';
      for (const valor of lista) {
        contenedor.appendChild(el('button', {
          class: 'chip', onclick: async () => {
            const ok = await confirmarAccion(`¿Quitar "${valor}" de la lista? (No se borran productos ya guardados con este valor.)`);
            if (!ok) return;
            const nueva = lista.filter(v => v !== valor);
            await Meta.guardar(key, nueva);
            this.render(cont);
          }
        }, valor + ' ✕'));
      }
    };
    pintarChips(cont.querySelector('#chips-tiendas'), tiendas, 'tiendas');
    pintarChips(cont.querySelector('#chips-categorias'), categorias, 'categorias');

    cont.querySelector('#btn-agregar-tienda').addEventListener('click', async () => {
      const input = cont.querySelector('#nueva-tienda');
      const valor = input.value.trim();
      if (!valor || tiendas.includes(valor)) return;
      tiendas.push(valor);
      await Meta.guardar('tiendas', tiendas);
      this.render(cont);
    });
    cont.querySelector('#btn-agregar-categoria').addEventListener('click', async () => {
      const input = cont.querySelector('#nueva-categoria');
      const valor = input.value.trim();
      if (!valor || categorias.includes(valor)) return;
      categorias.push(valor);
      await Meta.guardar('categorias', categorias);
      this.render(cont);
    });
  }
};
