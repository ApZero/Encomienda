// calc.js — toda la matemática del lote: cambio USD→Gs y prorrateo de Sendit por peso

function calcularLote(lote, productos) {
  const totalUsdItems = productos.reduce((s, p) => s + (Number(p.precio_usd) || 0), 0);
  const impuestos = Number(lote.impuestos_usd) || 0;
  const envioIntl = Number(lote.envio_intl_usd) || 0;
  const totalUsd = totalUsdItems + impuestos + envioIntl;
  const montoPagadoGs = Number(lote.monto_pagado_gs) || 0;
  const tasaCambio = totalUsd > 0 ? montoPagadoGs / totalUsd : 0;

  const pesoEmbalaje = Number(lote.peso_embalaje_g) || 0;
  const pesoItems = productos.reduce((s, p) => s + (Number(p.peso_g) || 0), 0);
  const pesoTotal = pesoItems + pesoEmbalaje;
  const senditPagadoGs = Number(lote.sendit_pagado_gs) || 0;

  const items = productos.map(p => {
    const precioUsd = Number(p.precio_usd) || 0;
    const pesoG = Number(p.peso_g) || 0;
    // cada producto carga su parte proporcional de impuestos + envío internacional
    const shareUsd = totalUsdItems > 0 ? precioUsd / totalUsdItems : (productos.length ? 1 / productos.length : 0);
    const usdConCargos = precioUsd + shareUsd * (impuestos + envioIntl);
    const gsProducto = usdConCargos * tasaCambio;
    const pesoShare = pesoTotal > 0 ? pesoG / pesoTotal : 0;
    const senditGs = pesoShare * senditPagadoGs;
    const totalGs = gsProducto + senditGs;
    return {
      producto: p,
      usdConCargos,
      gsProducto,
      senditGs,
      totalGs,
      pesoShare
    };
  });

  return {
    totalUsdItems,
    totalUsd,
    tasaCambio,
    pesoItems,
    pesoTotal,
    senditPagadoGs,
    montoPagadoGs,
    totalGeneralGs: montoPagadoGs + senditPagadoGs,
    items
  };
}

// tasa Sendit histórica promedio (Gs por gramo), usada por el planificador de recompra
function tasaSenditPromedio(lotes) {
  let totalGs = 0, totalPeso = 0;
  for (const lote of lotes) {
    const gs = Number(lote.sendit_pagado_gs) || 0;
    if (gs <= 0) continue;
    totalGs += gs;
    totalPeso += (lote._pesoTotalCalculado || 0);
  }
  return totalPeso > 0 ? totalGs / totalPeso : 0;
}

function tasaCambioPromedio(lotes) {
  const validas = lotes.map(l => l._tasaCambioCalculada).filter(t => t > 0);
  if (!validas.length) return 0;
  return validas.reduce((a, b) => a + b, 0) / validas.length;
}

function formatoGs(valor) {
  return '₲ ' + Math.round(valor || 0).toLocaleString('es-PY');
}

function formatoUsd(valor) {
  return '$ ' + (valor || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatoFecha(fechaStr) {
  if (!fechaStr) return '';
  const [y, m, d] = fechaStr.split('-');
  return `${d}/${m}/${y}`;
}

function formatoPeso(gramos) {
  gramos = Number(gramos) || 0;
  if (gramos >= 1000) return (gramos / 1000).toLocaleString('es-PY', { maximumFractionDigits: 2 }) + ' kg';
  return gramos.toLocaleString('es-PY') + ' g';
}
