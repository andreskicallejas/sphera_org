/**
 * src/js/flowchart.js
 * ──────────────────────────────────────────────────────────────────
 * Renderiza el diagrama de flujo jerárquico en SVG dentro del panel
 * inferior. Muestra la cadena de padres desde la raíz hasta el nodo
 * seleccionado. Para nodos no-artículo también muestra los hijos
 * directos (modo expandible si hay más de MAX_CHILDREN).
 *
 * Expone: window.AppFlowchart
 * ──────────────────────────────────────────────────────────────────
 */
window.AppFlowchart = (function () {
  const H   = window.AppHelpers;
  const REL = window.APP_RELATIONS;

  /* Dimensiones de los bloques */
  const BOX_W       = 160;
  const BOX_H       = 52;
  const GAP_X       = 44;    // espacio entre bloques
  const PAD_Y       = 22;    // padding vertical del SVG
  const CORNER_R    = 8;
  const MAX_CHILDREN = 10;   // máximo de hijos visibles antes de expandir

  /* Color uniforme de flechas (coincide con LINE_COLOR en particles.js) */
  const ARROW_COLOR       = 'rgba(102,153,204,0.65)';
  const ARROW_COLOR_CHILD = 'rgba(102,153,204,0.35)';

  let panel, svg, titleEl;
  let _expandedForNode = null; // id del nodo cuyos hijos están expandidos

  /* ── init ──────────────────────────────────────────────────── */
  function init() {
    panel   = document.getElementById('flowchart-panel');
    svg     = document.getElementById('flowchart-svg');
    titleEl = document.getElementById('flowchart-title');
  }

  /* ── render ─────────────────────────────────────────────────── */
  function render(nodeId) {
    const node = REL.nodeMap.get(nodeId);
    let path;

    if (node && node.type === 'articulo' && node.relacionDirecta) {
      const targetPath = REL.getPath(node.relacionDirecta);
      path = [...targetPath, node];
    } else {
      path = REL.getPath(nodeId);
    }
    if (!path || path.length === 0) { clear(); return; }

    /* Hijos del nodo seleccionado (solo para no-artículos) */
    let children    = [];
    let hiddenCount = 0;
    if (node && node.type !== 'articulo') {
      const allChildren = REL.getChildren(nodeId);
      const isExpanded  = (_expandedForNode === nodeId);
      if (allChildren.length > MAX_CHILDREN && !isExpanded) {
        children    = allChildren.slice(0, MAX_CHILDREN);
        hiddenCount = allChildren.length - MAX_CHILDREN;
      } else {
        children = allChildren;
      }
    }

    /* Mostrar panel y título */
    panel.classList.remove('hidden');
    if (titleEl) {
      titleEl.textContent = (node && node.type === 'articulo' && node.relacionDirecta)
        ? 'Cadena de operación del artículo'
        : 'Cadena jerárquica';
    }

    /* Dimensiones del SVG */
    const showMore  = hiddenCount > 0;
    const total     = path.length + children.length + (showMore ? 1 : 0);
    const totalW    = total * BOX_W + (total - 1) * GAP_X + 32;
    const totalH    = BOX_H + PAD_Y * 2;

    svg.setAttribute('width',   totalW);
    svg.setAttribute('height',  totalH);
    svg.setAttribute('viewBox', `0 0 ${totalW} ${totalH}`);

    /* Limpiar */
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    /* Marcadores de flecha */
    const defs = _svgEl('defs');
    defs.innerHTML = `
      <marker id="arr-path" markerWidth="8" markerHeight="8"
              refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L8,3 z" fill="${ARROW_COLOR}"/>
      </marker>
      <marker id="arr-child" markerWidth="8" markerHeight="8"
              refX="6" refY="3" orient="auto" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L8,3 z" fill="${ARROW_COLOR_CHILD}"/>
      </marker>`;
    svg.appendChild(defs);

    /* Cadena principal */
    path.forEach((pNode, i) => {
      const x       = 16 + i * (BOX_W + GAP_X);
      const y       = PAD_Y;
      const isLast  = (i === path.length - 1);
      const isFirst = (i === 0);

      _drawBox(pNode, x, y, isLast, false);

      if (!isLast) {
        /* Flecha al siguiente nodo de la cadena */
        _drawLine(
          x + BOX_W, y + BOX_H / 2,
          x + BOX_W + GAP_X - 2, y + BOX_H / 2,
          ARROW_COLOR, false, 'arr-path'
        );
      } else if (children.length > 0) {
        /* Flecha al primer hijo (dashed) */
        _drawLine(
          x + BOX_W, y + BOX_H / 2,
          x + BOX_W + GAP_X - 2, y + BOX_H / 2,
          ARROW_COLOR_CHILD, true, 'arr-child'
        );
      }
    });

    /* Hijos */
    children.forEach((child, i) => {
      const x = 16 + (path.length + i) * (BOX_W + GAP_X);
      const y = PAD_Y;
      _drawBox(child, x, y, false, true);

      const hasNext = (i < children.length - 1) || showMore;
      if (hasNext) {
        _drawLine(
          x + BOX_W, y + BOX_H / 2,
          x + BOX_W + GAP_X - 2, y + BOX_H / 2,
          ARROW_COLOR_CHILD, true, 'arr-child'
        );
      }
    });

    /* Botón "N más…" */
    if (showMore) {
      const x = 16 + (path.length + children.length) * (BOX_W + GAP_X);
      _drawMoreBox(nodeId, x, PAD_Y, hiddenCount);
    }
  }

  /* ── Dibuja un bloque ───────────────────────────────────────── */
  function _drawBox(node, x, y, isSelected, isChild) {
    const typeColor = H.typeColor(node.type);
    const typeLabel = H.typeLabel(node.type);
    const title     = H.truncate(node.title, 22);

    const g = _svgEl('g');
    g.setAttribute('transform', `translate(${x},${y})`);
    g.style.cursor = 'pointer';
    g.addEventListener('click', function () {
      AppParticles.selectNode(node.id);
      AppUI.showDetail(node);
      AppFlowchart.render(node.id);
    });

    /* Fondo */
    const rect = _svgEl('rect');
    rect.setAttribute('width',  BOX_W);
    rect.setAttribute('height', BOX_H);
    rect.setAttribute('rx', CORNER_R);
    rect.setAttribute('ry', CORNER_R);
    if (isSelected) {
      rect.setAttribute('fill',         `${typeColor}22`);
      rect.setAttribute('stroke',       typeColor);
      rect.setAttribute('stroke-width', '1.8');
    } else if (isChild) {
      rect.setAttribute('fill',             'rgba(10,15,32,0.75)');
      rect.setAttribute('stroke',           'rgba(102,153,204,0.25)');
      rect.setAttribute('stroke-width',     '1');
      rect.setAttribute('stroke-dasharray', '4,3');
    } else {
      rect.setAttribute('fill',         'rgba(12,17,36,0.8)');
      rect.setAttribute('stroke',       'rgba(80,110,200,0.25)');
      rect.setAttribute('stroke-width', '1');
    }
    g.appendChild(rect);

    /* Banda de color superior */
    const band = _svgEl('rect');
    band.setAttribute('width', BOX_W);
    band.setAttribute('height', 4);
    band.setAttribute('rx', CORNER_R);
    band.setAttribute('ry', CORNER_R);
    band.setAttribute('fill',    typeColor);
    band.setAttribute('opacity', isSelected ? '0.9' : (isChild ? '0.30' : '0.55'));
    g.appendChild(band);

    /* Etiqueta de tipo */
    const typeText = _svgEl('text');
    typeText.setAttribute('x',            BOX_W / 2);
    typeText.setAttribute('y',            20);
    typeText.setAttribute('text-anchor',  'middle');
    typeText.setAttribute('fill',         isChild ? 'rgba(150,170,210,0.55)' : typeColor);
    typeText.setAttribute('font-size',    '9');
    typeText.setAttribute('font-weight',  '700');
    typeText.setAttribute('font-family',  'Segoe UI, system-ui, sans-serif');
    typeText.setAttribute('letter-spacing', '0.06em');
    typeText.textContent = typeLabel.toUpperCase();
    g.appendChild(typeText);

    /* Título */
    const titleText = _svgEl('text');
    titleText.setAttribute('x',           BOX_W / 2);
    titleText.setAttribute('y',           37);
    titleText.setAttribute('text-anchor', 'middle');
    titleText.setAttribute('fill',
      isSelected ? '#e8eaf6' : (isChild ? 'rgba(120,140,180,0.60)' : '#8892b0'));
    titleText.setAttribute('font-size',   '11');
    titleText.setAttribute('font-weight', isSelected ? '600' : '400');
    titleText.setAttribute('font-family', 'Segoe UI, system-ui, sans-serif');
    titleText.textContent = title;
    g.appendChild(titleText);

    /* Tooltip nativo SVG */
    const tip = _svgEl('title');
    tip.textContent = node.title;
    g.appendChild(tip);

    svg.appendChild(g);
  }

  /* ── Botón "N más…" ─────────────────────────────────────────── */
  function _drawMoreBox(nodeId, x, y, count) {
    const g = _svgEl('g');
    g.setAttribute('transform', `translate(${x},${y})`);
    g.style.cursor = 'pointer';
    g.addEventListener('click', function () {
      _expandedForNode = nodeId;
      render(nodeId);
    });

    const rect = _svgEl('rect');
    rect.setAttribute('width', BOX_W);
    rect.setAttribute('height', BOX_H);
    rect.setAttribute('rx', CORNER_R);
    rect.setAttribute('ry', CORNER_R);
    rect.setAttribute('fill',             'rgba(10,15,32,0.75)');
    rect.setAttribute('stroke',           'rgba(102,153,204,0.25)');
    rect.setAttribute('stroke-width',     '1');
    rect.setAttribute('stroke-dasharray', '4,3');
    g.appendChild(rect);

    const text = _svgEl('text');
    text.setAttribute('x',           BOX_W / 2);
    text.setAttribute('y',           BOX_H / 2 + 5);
    text.setAttribute('text-anchor', 'middle');
    text.setAttribute('fill',        'rgba(140,170,210,0.70)');
    text.setAttribute('font-size',   '12');
    text.setAttribute('font-weight', '600');
    text.setAttribute('font-family', 'Segoe UI, system-ui, sans-serif');
    text.textContent = `+ ${count} más`;
    g.appendChild(text);

    const tip = _svgEl('title');
    tip.textContent = `Ver ${count} elementos más`;
    g.appendChild(tip);

    svg.appendChild(g);
  }

  /* ── Dibuja una línea de conexión ───────────────────────────── */
  function _drawLine(x1, y1, x2, y2, color, dashed, markerId) {
    const line = _svgEl('line');
    line.setAttribute('x1', x1);
    line.setAttribute('y1', y1);
    line.setAttribute('x2', x2);
    line.setAttribute('y2', y2);
    line.setAttribute('stroke',       color);
    line.setAttribute('stroke-width', '1.5');
    if (dashed) line.setAttribute('stroke-dasharray', '4,3');
    line.setAttribute('marker-end', `url(#${markerId})`);
    svg.appendChild(line);
  }

  /* ── clear ──────────────────────────────────────────────────── */
  function clear() {
    _expandedForNode = null;
    panel.classList.add('hidden');
    while (svg.firstChild) svg.removeChild(svg.firstChild);
  }

  /* ── Utilidad SVG ───────────────────────────────────────────── */
  function _svgEl(tag) {
    return document.createElementNS('http://www.w3.org/2000/svg', tag);
  }

  /* ── API pública ─────────────────────────────────────────────── */
  return { init, render, clear };
})();
