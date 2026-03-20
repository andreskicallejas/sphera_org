/**
 * src/js/ui.js
 * ──────────────────────────────────────────────────────────────────
 * Gestión del panel derecho de detalle del nodo seleccionado.
 *
 * Expone: window.AppUI
 * ──────────────────────────────────────────────────────────────────
 */
window.AppUI = (function () {
  const H   = window.AppHelpers;
  const REL = window.APP_RELATIONS;

  /* Referencias DOM */
  let elEmpty, elDetail;
  let elBadge, elTitle, elId;
  let elDesc, elObjetivo, elContenido, elRuta;
  /* Campos de artículo */
  let elSectionArticulo;
  let elTipoArticulo, elRelDirecta, elSegmentos, elFamilias;

  /* Mapa de badge styles por tipo */
  const BADGE_STYLES = {
    empresa:      { bg: 'rgba(255,215,0,0.15)',   color: '#FFD700', border: 'rgba(255,215,0,0.35)'  },
    subdominio:   { bg: 'rgba(255,140,0,0.15)',   color: '#FF8C00', border: 'rgba(255,140,0,0.35)'  },
    producto:     { bg: 'rgba(41,128,185,0.15)',  color: '#2980B9', border: 'rgba(41,128,185,0.35)' },
    macroproceso: { bg: 'rgba(155,89,182,0.15)',  color: '#9B59B6', border: 'rgba(155,89,182,0.35)' },
    proceso:      { bg: 'rgba(26,188,156,0.15)',  color: '#1ABC9C', border: 'rgba(26,188,156,0.35)' },
    actividad:    { bg: 'rgba(39,174,96,0.15)',   color: '#27AE60', border: 'rgba(39,174,96,0.35)'  },
    tarea:        { bg: 'rgba(243,156,18,0.15)',  color: '#F39C12', border: 'rgba(243,156,18,0.35)' },
    articulo:     { bg: 'rgba(231,76,60,0.15)',   color: '#E74C3C', border: 'rgba(231,76,60,0.35)'  },
  };

  /* ── init ──────────────────────────────────────────────────── */
  function init() {
    elEmpty   = document.getElementById('panel-empty');
    elDetail  = document.getElementById('panel-detail');
    elBadge   = document.getElementById('detail-type-badge');
    elTitle   = document.getElementById('detail-title');
    elId      = document.getElementById('detail-id');
    elDesc    = document.getElementById('detail-description');
    elObjetivo   = document.getElementById('detail-objetivo');
    elContenido  = document.getElementById('detail-contenido');
    elRuta       = document.getElementById('detail-ruta');
    elSectionArticulo = document.getElementById('section-articulo');
    elTipoArticulo    = document.getElementById('detail-tipo-articulo');
    elRelDirecta      = document.getElementById('detail-relacion-directa');
    elSegmentos       = document.getElementById('detail-segmentos');
    elFamilias        = document.getElementById('detail-familias');
  }

  /* ── showEmpty ──────────────────────────────────────────────── */
  function showEmpty() {
    elEmpty.classList.remove('hidden');
    elDetail.classList.add('hidden');
    elDetail.removeAttribute('data-node-id');
    elDetail.removeAttribute('data-node-type');
    elDetail.removeAttribute('data-node-title');
    elDetail.removeAttribute('data-node-tipo-articulo');
  }

  /* ── showDetail ─────────────────────────────────────────────── */
  function showDetail(node) {
    elEmpty.classList.add('hidden');
    elDetail.classList.remove('hidden');

    /* Data-attributes HTML en el panel de detalle (Fix 6) */
    elDetail.setAttribute('data-node-id',    node.id);
    elDetail.setAttribute('data-node-type',  node.type);
    elDetail.setAttribute('data-node-title', node.title);
    if (node.tipoArticulo) elDetail.setAttribute('data-node-tipo-articulo', node.tipoArticulo);
    else elDetail.removeAttribute('data-node-tipo-articulo');

    /* Badge de tipo */
    const style = BADGE_STYLES[node.type] || BADGE_STYLES.articulo;
    elBadge.textContent = H.typeLabel(node.type);
    elBadge.style.setProperty('--badge-bg',     style.bg);
    elBadge.style.setProperty('--badge-color',  style.color);
    elBadge.style.setProperty('--badge-border', style.border);
    elBadge.style.background   = style.bg;
    elBadge.style.color        = style.color;
    elBadge.style.borderColor  = style.border;

    /* Campos básicos */
    elTitle.textContent     = node.title;
    elId.textContent        = `id: ${node.id}`;
    elDesc.textContent      = node.description   || '—';
    elObjetivo.textContent  = node.objetivo       || '—';
    elContenido.textContent = node.contenido      || '—';

    /* Ruta jerárquica */
    // Para artículos con relacionDirecta: mostrar la ruta del nodo destino + artículo
    let pathNodes;
    if (node.type === 'articulo' && node.relacionDirecta) {
      const targetPath = REL.getPath(node.relacionDirecta);
      pathNodes = [...targetPath, node];
    } else {
      pathNodes = REL.getPath(node.id);
    }
    if (pathNodes.length > 0) {
      elRuta.innerHTML = pathNodes
        .map(n => `<span style="color:${H.typeColor(n.type)}">${n.title}</span>`)
        .join(' <span style="color:#4a5580"> › </span>');
    } else {
      elRuta.textContent = '—';
    }

    /* Sección artículo */
    if (node.type === 'articulo') {
      elSectionArticulo.classList.remove('hidden');
      elTipoArticulo.textContent = H.formatTipoArticulo(node.tipoArticulo);

      /* Relación directa */
      if (node.relacionDirecta) {
        const rel = REL.nodeMap.get(node.relacionDirecta);
        elRelDirecta.innerHTML = rel
          ? `<span style="color:${H.typeColor(rel.type)}">${rel.title}</span> <small style="color:#4a5580">(${H.typeLabel(rel.type)})</small>`
          : node.relacionDirecta;
      } else {
        elRelDirecta.textContent = '—';
      }

      elSegmentos.textContent = H.formatSegmentos(node.segmentos);
      elFamilias.textContent  = H.formatFamilias(node.familias);
    } else {
      elSectionArticulo.classList.add('hidden');
    }

    /* Scroll al inicio del panel */
    elDetail.scrollTop = 0;
  }

  /* ── API pública ─────────────────────────────────────────────── */
  return { init, showEmpty, showDetail };
})();
