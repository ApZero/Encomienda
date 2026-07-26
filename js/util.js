// util.js — utilidades compartidas de UI

function redimensionarImagen(file, maxLado = 900, calidad = 0.75) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      let { width, height } = img;
      if (width > height && width > maxLado) { height = height * (maxLado / width); width = maxLado; }
      else if (height > maxLado) { width = width * (maxLado / height); height = maxLado; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', calidad));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

function mostrarToast(mensaje, tipo = 'info') {
  const cont = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast toast--${tipo}`;
  el.textContent = mensaje;
  cont.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast--visible'));
  setTimeout(() => {
    el.classList.remove('toast--visible');
    setTimeout(() => el.remove(), 300);
  }, 3200);
}

function estrellas(valor, max = 5, interactivo = false, onChange = null) {
  const cont = document.createElement('div');
  cont.className = 'estrellas' + (interactivo ? ' estrellas--interactivo' : '');
  for (let i = 1; i <= max; i++) {
    const s = document.createElement('span');
    s.className = 'estrella' + (i <= (valor || 0) ? ' estrella--llena' : '');
    s.textContent = i <= (valor || 0) ? '★' : '☆';
    if (interactivo) {
      s.addEventListener('click', () => onChange(i === valor ? 0 : i));
    }
    cont.appendChild(s);
  }
  return cont;
}

function estrellasTexto(valor, max = 5) {
  valor = valor || 0;
  return '★'.repeat(valor) + '☆'.repeat(max - valor);
}

function confirmarAccion(mensaje) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('modal-overlay');
    overlay.innerHTML = `
      <div class="modal">
        <p class="modal__mensaje">${mensaje}</p>
        <div class="modal__acciones">
          <button class="btn btn--fantasma" data-accion="cancelar">Cancelar</button>
          <button class="btn btn--peligro" data-accion="confirmar">Confirmar</button>
        </div>
      </div>`;
    overlay.classList.add('visible');
    overlay.onclick = (e) => {
      if (e.target === overlay) { cerrar(false); return; }
      const accion = e.target.dataset.accion;
      if (accion === 'confirmar') cerrar(true);
      if (accion === 'cancelar') cerrar(false);
    };
    function cerrar(valor) {
      overlay.classList.remove('visible');
      overlay.innerHTML = '';
      overlay.onclick = null;
      resolve(valor);
    }
  });
}

function el(tag, opciones = {}, hijos = []) {
  const nodo = document.createElement(tag);
  for (const [k, v] of Object.entries(opciones)) {
    if (k === 'class') nodo.className = v;
    else if (k === 'html') nodo.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') nodo.addEventListener(k.slice(2), v);
    else if (v !== undefined && v !== null) nodo.setAttribute(k, v);
  }
  for (const h of [].concat(hijos)) {
    if (h == null) continue;
    nodo.appendChild(typeof h === 'string' ? document.createTextNode(h) : h);
  }
  return nodo;
}

function debounce(fn, ms = 250) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
