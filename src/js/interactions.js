/**
 * src/js/interactions.js
 * ──────────────────────────────────────────────────────────────────
 * Manejo de eventos del mouse sobre el canvas Three.js:
 *  - Hover → tooltip con nombre del nodo
 *  - Clic  → selección de nodo (llama a particles, ui, flowchart)
 *  - El zoom y la rotación los gestiona OrbitControls
 *
 * Expone: window.AppInteractions
 * ──────────────────────────────────────────────────────────────────
 */
window.AppInteractions = (function () {
  const H   = window.AppHelpers;
  const REL = window.APP_RELATIONS;

  let raycaster;
  let mouse;          // THREE.Vector2 normalizado
  let hoveredId = null;
  let tooltip;

  /* ── init ──────────────────────────────────────────────────── */
  function init() {
    const wrapper  = AppScene.getWrapper();
    const renderer = AppScene.getRenderer();

    raycaster = new THREE.Raycaster();
    // Umbral más grande facilita seleccionar partículas pequeñas
    raycaster.params.Points = { threshold: 0.1 };
    mouse   = new THREE.Vector2();
    tooltip = document.getElementById('tooltip');

    /* Mouse move → hover */
    renderer.domElement.addEventListener('mousemove', _onMouseMove);

    /* Click → selección */
    renderer.domElement.addEventListener('click', _onClick);

    /* Desseleccionar clicando en el vacío se maneja en _onClick */

    /* Botón de cierre del flowchart */
    document.getElementById('flowchart-close').addEventListener('click', () => {
      AppParticles.selectNode(null);
      AppUI.showEmpty();
      AppFlowchart.clear();
      document.querySelectorAll('.legend-item[data-type]').forEach(e => e.classList.remove('legend-active'));
      const si = document.getElementById('search-input');
      const sc = document.getElementById('search-clear');
      const sm = document.getElementById('search-msg');
      if (si) si.value = '';
      if (sc) sc.classList.add('hidden');
      if (sm) sm.classList.add('hidden');
    });

    /* Leyenda — clic activa filtro por tipo (toggle) */
    document.querySelectorAll('.legend-item[data-type]').forEach(el => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        const type    = el.getAttribute('data-type');
        const current = AppParticles.getLegendFilterType();
        AppParticles.filterByType(current === type ? null : type);

        // Marcar visualmente el item activo
        document.querySelectorAll('.legend-item[data-type]').forEach(e => {
          e.classList.toggle('legend-active', e === el && current !== type);
        });
      });
    });

    /* Barra de búsqueda */
    const searchInput = document.getElementById('search-input');
    const searchBtn   = document.getElementById('search-btn');
    const searchClear = document.getElementById('search-clear');
    const searchMsg   = document.getElementById('search-msg');

    function _doSearch() {
      const q = searchInput.value.trim();
      if (!q) { _clearSearch(); return; }
      AppParticles.filterBySearch(q);
      searchClear.classList.remove('hidden');
      document.querySelectorAll('.legend-item[data-type]').forEach(e => e.classList.remove('legend-active'));

      // Mostrar mensaje si no hay resultados
      const filter = AppParticles.getSearchFilter();
      if (searchMsg) {
        if (filter && filter.size === 0) {
          searchMsg.textContent = `No se encontró "${q}"`;
          searchMsg.classList.remove('hidden');
        } else {
          searchMsg.classList.add('hidden');
        }
      }
    }

    function _clearSearch() {
      searchInput.value = '';
      searchClear.classList.add('hidden');
      if (searchMsg) searchMsg.classList.add('hidden');
      AppParticles.filterBySearch(null);
    }

    searchBtn.addEventListener('click', _doSearch);
    searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') _doSearch(); });
    searchClear.addEventListener('click', _clearSearch);

    /* Registrar update en el loop */
    AppScene.onFrame(_updateHover);
  }

  /* ── Mouse coordinates → NDC ────────────────────────────────── */
  function _toNDC(event) {
    const wrapper = AppScene.getWrapper();
    const rect    = wrapper.getBoundingClientRect();
    mouse.x =  ((event.clientX - rect.left)  / rect.width)  * 2 - 1;
    mouse.y = -((event.clientY - rect.top)   / rect.height) * 2 + 1;
  }

  /* ── Hover (actualizado en cada frame) ─────────────────────── */
  function _onMouseMove(event) {
    _toNDC(event);
    // Guardar posición real del cursor para el tooltip
    tooltip._clientX = event.clientX;
    tooltip._clientY = event.clientY;
  }

  function _updateHover() {
    if (!mouse) return;
    const camera = AppScene.getCamera();
    const wrapper = AppScene.getWrapper();

    raycaster.setFromCamera(mouse, camera);
    const hit = AppParticles.intersectNodes(raycaster);

    if (hit !== hoveredId) {
      hoveredId = hit;
      if (hit) {
        const node = REL.nodeMap.get(hit);
        _showTooltip(node);
        wrapper.style.cursor = 'pointer';
      } else {
        _hideTooltip();
        wrapper.style.cursor = 'grab';
      }
    }

    // Actualizar posición del tooltip si está visible
    if (hoveredId && tooltip.classList.contains('visible')) {
      const rect = wrapper.getBoundingClientRect();
      tooltip.style.left = (tooltip._clientX - rect.left) + 'px';
      tooltip.style.top  = (tooltip._clientY - rect.top)  + 'px';
    }
  }

  /* ── Click → selección ──────────────────────────────────────── */
  function _onClick(event) {
    _toNDC(event);
    const camera = AppScene.getCamera();
    raycaster.setFromCamera(mouse, camera);
    const hit = AppParticles.intersectNodes(raycaster);

    if (hit) {
      // Seleccionar el nodo pulsado
      const node = REL.nodeMap.get(hit);
      AppParticles.selectNode(hit);
      AppUI.showDetail(node);
      AppFlowchart.render(hit);
      // Detener auto-rotación al interactuar
      AppScene.setAutoRotate(false);
    } else {
      // Clic en vacío → limpiar selección, filtros y búsqueda
      AppParticles.selectNode(null);
      AppUI.showEmpty();
      AppFlowchart.clear();
      document.querySelectorAll('.legend-item[data-type]').forEach(e => e.classList.remove('legend-active'));
      const si = document.getElementById('search-input');
      const sc = document.getElementById('search-clear');
      const sm = document.getElementById('search-msg');
      if (si) si.value = '';
      if (sc) sc.classList.add('hidden');
      if (sm) sm.classList.add('hidden');
    }
  }

  /* ── Tooltip ────────────────────────────────────────────────── */
  function _showTooltip(node) {
    const meta = window.APP_DATA.LEVEL_META[node.type];
    tooltip.setAttribute('data-node-id',    node.id);
    tooltip.setAttribute('data-node-type',  node.type);
    tooltip.setAttribute('data-node-title', node.title);
    tooltip.innerHTML =
      `<span style="color:${H.typeColor(node.type)};font-weight:700">`
      + `${meta.label}</span> · ${H.truncate(node.title, 40)}`;
    tooltip.classList.add('visible');
  }

  function _hideTooltip() {
    tooltip.removeAttribute('data-node-id');
    tooltip.removeAttribute('data-node-type');
    tooltip.removeAttribute('data-node-title');
    tooltip.classList.remove('visible');
  }

  /* ── API pública ─────────────────────────────────────────────── */
  return { init };
})();
