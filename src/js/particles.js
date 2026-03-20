/**
 * src/js/particles.js
 * ──────────────────────────────────────────────────────────────────
 * Gestión de las partículas 3D y sus conexiones (líneas).
 *
 * Estados visuales de partícula:
 *   'normal'      — sin selección: color original, brillo estelar completo
 *   'selected'    — nodo elegido: escala 1.3×, glow máximo
 *   'highlighted' — ascendencia / hermanos: brillo reducido pero con color
 *   'child'       — hijos directos (nodo no artículo): color tenue
 *   'grey'        — no interviene: blanco-gris apagado, casi sin halos
 *
 * Expone: window.AppParticles
 * ──────────────────────────────────────────────────────────────────
 */
window.AppParticles = (function () {
  const H = window.AppHelpers;
  const { nodes, LEVEL_META } = window.APP_DATA;
  const REL = window.APP_RELATIONS;

  /* ── Constantes visuales ─────────────────────────────────────── */
  const LINE_OPACITY_HIGHLIGHT = 0.75;
  /* Color uniforme para TODAS las líneas */
  const LINE_COLOR  = 0x6699cc;
  /* Color del estado reposo — blanco-azul tenue, perceptible pero discreto */
  const GREY_COLOR  = 0x8899bb;

  /* ── Estado interno ─────────────────────────────────────────── */
  let sphereGroup;
  let meshById       = {};
  let lineByEdgeKey  = {};
  let selectedId     = null;
  let highlightSet   = new Set();   // ancestros + hermanos
  let childSet       = new Set();   // hijos directos del nodo seleccionado
  let legendFilterType = null;      // tipo activo desde la leyenda
  let searchFilter   = null;        // Set<id> con resultados de búsqueda, o null
  let dataLayer      = null;

  /* ── Build ───────────────────────────────────────────────────── */
  function build(scene) {
    sphereGroup = new THREE.Group();
    scene.add(sphereGroup);

    dataLayer = document.getElementById('particle-data-layer');

    const positionsByNode = _computePositions();

    nodes.forEach(node => {
      const meta = LEVEL_META[node.type];
      const pos  = positionsByNode[node.id];
      if (!pos) return;

      /* Cuerpo principal */
      const geo = new THREE.SphereGeometry(meta.particleSize, 10, 10);
      const mat = new THREE.MeshBasicMaterial({
        color: meta.color,
        transparent: true,
        opacity: 0.90,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      mesh.userData.nodeId = node.id;
      mesh.userData.originalColor = meta.color;

      /* Núcleo blanco brillante */
      const coreGeo = new THREE.SphereGeometry(meta.particleSize * 0.40, 6, 6);
      const coreMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.92,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const core = new THREE.Mesh(coreGeo, coreMat);
      mesh.add(core);

      /* Halo exterior difuso */
      const glowGeo = new THREE.SphereGeometry(meta.particleSize * 3.2, 8, 8);
      const glowMat = new THREE.MeshBasicMaterial({
        color: meta.color,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const glow = new THREE.Mesh(glowGeo, glowMat);
      mesh.add(glow);

      /* Halo medio */
      const midGeo = new THREE.SphereGeometry(meta.particleSize * 1.7, 8, 8);
      const midMat = new THREE.MeshBasicMaterial({
        color: meta.color,
        transparent: true,
        opacity: 0.30,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
      const mid = new THREE.Mesh(midGeo, midMat);
      mesh.add(mid);

      mesh.userData.baseMat  = mat;
      mesh.userData.coreMat  = coreMat;
      mesh.userData.glowMat  = glowMat;
      mesh.userData.midMat   = midMat;

      sphereGroup.add(mesh);
      meshById[node.id] = mesh;

      /* Elemento HTML con data-attributes */
      if (dataLayer) {
        const el = document.createElement('span');
        el.setAttribute('data-node-id',    node.id);
        el.setAttribute('data-node-type',  node.type);
        el.setAttribute('data-node-title', node.title);
        el.setAttribute('data-node-color', '#' + meta.color.toString(16).padStart(6, '0'));
        if (node.parentId)        el.setAttribute('data-node-parent-id',        node.parentId);
        if (node.relacionDirecta) el.setAttribute('data-node-relacion-directa', node.relacionDirecta);
        if (node.tipoArticulo)    el.setAttribute('data-node-tipo-articulo',     node.tipoArticulo);
        el.hidden = true;
        dataLayer.appendChild(el);
      }
    });

    /* Líneas padre-hijo */
    nodes.forEach(node => {
      const pid = REL.parentMap.get(node.id);
      if (!pid) return;
      const childPos  = positionsByNode[node.id];
      const parentPos = positionsByNode[pid];
      if (!childPos || !parentPos) return;

      const key = `${pid}|${node.id}`;
      const geo = new THREE.BufferGeometry().setFromPoints([parentPos.clone(), childPos.clone()]);
      const mat = new THREE.LineBasicMaterial({
        color: LINE_COLOR,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const line = new THREE.Line(geo, mat);
      sphereGroup.add(line);
      lineByEdgeKey[key] = line;
    });

    /* Líneas artículo → relacionDirecta */
    nodes
      .filter(n => n.type === 'articulo' && n.relacionDirecta)
      .forEach(art => {
        const targetId = art.relacionDirecta;
        const artPos   = positionsByNode[art.id];
        const tgtPos   = positionsByNode[targetId];
        if (!artPos || !tgtPos) return;

        const key = `rel:${art.id}|${targetId}`;
        const geo = new THREE.BufferGeometry().setFromPoints([tgtPos.clone(), artPos.clone()]);
        const mat = new THREE.LineBasicMaterial({
          color: LINE_COLOR,
          transparent: true,
          opacity: 0,
          depthWrite: false,
        });
        const line = new THREE.Line(geo, mat);
        sphereGroup.add(line);
        lineByEdgeKey[key] = line;
      });

    /* Registrar animación de pulso para líneas de hijos */
    AppScene.onFrame(_onFrame);
  }

  /* ── Pulso de líneas hijo (ejecutado cada frame) ─────────────── */
  function _onFrame() {
    if (childSet.size === 0) return;  // sin hijos activos, nada que animar
    const pulse = (Math.sin(Date.now() * 0.0040) + 1) * 0.5;  // 0–1 a ~0.6 Hz
    Object.entries(lineByEdgeKey).forEach(([key, line]) => {
      const mat = line.material;
      if (mat.opacity === 0) return;
      const isRelLine = key.startsWith('rel:');
      const rawKey    = isRelLine ? key.replace('rel:', '') : key;
      const [a, b]    = rawKey.split('|');
      const aActive   = (a === selectedId) || highlightSet.has(a);
      const bActive   = (b === selectedId) || highlightSet.has(b);
      const isChild   = childSet.has(a) || childSet.has(b);
      if (isChild && (aActive || bActive)) {
        // Pulsar entre 0.06 y 0.50
        mat.opacity = 0.06 + pulse * 0.44;
      }
    });
  }

  /* ── Posicionamiento ─────────────────────────────────────────── */
  function _computePositions() {
    const pos = {};
    const typeOrder = [
      'empresa', 'subdominio', 'macroproceso', 'producto',
      'proceso', 'actividad', 'tarea', 'articulo',
    ];
    typeOrder.forEach(type => {
      const nodesOfType = nodes.filter(n => n.type === type);
      const meta = LEVEL_META[type];
      const positions = H.fibonacciSphere(nodesOfType.length, meta.radius);
      nodesOfType.forEach((node, i) => { pos[node.id] = positions[i]; });
    });
    return pos;
  }

  /* ── Selección de nodo ───────────────────────────────────────── */
  function selectNode(nodeId) {
    legendFilterType = null;
    searchFilter     = null;
    selectedId       = nodeId;
    highlightSet     = new Set();
    childSet         = new Set();

    if (nodeId) {
      const selNode = REL.nodeMap.get(nodeId);

      if (selNode && selNode.type === 'articulo' && selNode.relacionDirecta) {
        /* Artículo: resaltar la cadena del relacionDirecta */
        const relId = selNode.relacionDirecta;
        highlightSet.add(relId);
        REL.getAncestors(relId).forEach(n => highlightSet.add(n.id));
        REL.getSiblings(relId).forEach(n => highlightSet.add(n.id));
        REL.getChildren(relId).forEach(n => highlightSet.add(n.id));
      } else {
        /* No-artículo: ancestros + hermanos resaltados; hijos → childSet (tenue) */
        REL.getAncestors(nodeId).forEach(n => highlightSet.add(n.id));
        REL.getSiblings(nodeId).forEach(n => highlightSet.add(n.id));
        REL.getChildren(nodeId).forEach(n => childSet.add(n.id));
      }
    }

    _updateVisuals();

    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) {
      const selNode = nodeId ? REL.nodeMap.get(nodeId) : null;
      if (nodeId && selNode) {
        wrapper.setAttribute('data-selected-node-id',    nodeId);
        wrapper.setAttribute('data-selected-node-type',  selNode.type);
        wrapper.setAttribute('data-selected-node-title', selNode.title);
      } else {
        wrapper.removeAttribute('data-selected-node-id');
        wrapper.removeAttribute('data-selected-node-type');
        wrapper.removeAttribute('data-selected-node-title');
      }
    }
  }

  /* ── Filtro por tipo (leyenda) ───────────────────────────────── */
  function filterByType(type) {
    legendFilterType = type;
    searchFilter     = null;
    selectedId       = null;
    highlightSet     = new Set();
    childSet         = new Set();
    _updateVisuals();

    if (typeof AppUI !== 'undefined')        AppUI.showEmpty();
    if (typeof AppFlowchart !== 'undefined') AppFlowchart.clear();

    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) {
      wrapper.removeAttribute('data-selected-node-id');
      wrapper.removeAttribute('data-selected-node-type');
      wrapper.removeAttribute('data-selected-node-title');
    }
  }

  /* ── Filtro por búsqueda de texto ───────────────────────────── */
  /**
   * Enciende solo las partículas cuyo título/descripción coincida con
   * la consulta. Pasar null o cadena vacía para limpiar el filtro.
   * @param {string|null} query
   */
  function filterBySearch(query) {
    legendFilterType = null;
    selectedId       = null;
    highlightSet     = new Set();
    childSet         = new Set();

    if (!query || !query.trim()) {
      searchFilter = null;
    } else {
      const q = query.trim().toLowerCase();
      const matched = new Set();
      REL.nodeMap.forEach((node, id) => {
        const title = (node.title       || '').toLowerCase();
        const desc  = (node.description || '').toLowerCase();
        const type  = (node.type        || '').toLowerCase();
        if (title.includes(q) || desc.includes(q) || type.includes(q)) {
          matched.add(id);
        }
      });
      searchFilter = matched;
    }

    _updateVisuals();

    if (typeof AppUI !== 'undefined')        AppUI.showEmpty();
    if (typeof AppFlowchart !== 'undefined') AppFlowchart.clear();

    const wrapper = document.getElementById('canvas-wrapper');
    if (wrapper) {
      wrapper.removeAttribute('data-selected-node-id');
      wrapper.removeAttribute('data-selected-node-type');
      wrapper.removeAttribute('data-selected-node-title');
    }
  }

  /* ── Estado visual por partícula ─────────────────────────────── */
  function _applyState(mesh, state) {
    const mat  = mesh.userData.baseMat;
    const glow = mesh.userData.glowMat;
    const mid  = mesh.userData.midMat;
    const core = mesh.userData.coreMat;
    const orig = mesh.userData.originalColor;

    switch (state) {
      case 'normal':
        mat.color.setHex(orig); glow.color.setHex(orig); mid.color.setHex(orig);
        mat.opacity  = 0.90; glow.opacity = 0.14; mid.opacity  = 0.30;
        core.opacity = 0.92; core.color.setHex(0xffffff);
        mesh.scale.setScalar(1);
        break;

      case 'selected':
        mat.color.setHex(orig); glow.color.setHex(orig); mid.color.setHex(orig);
        mat.opacity  = 1.00; glow.opacity = 0.45; mid.opacity  = 0.55;
        core.opacity = 1.00; core.color.setHex(0xffffff);
        mesh.scale.setScalar(1.3);   // reducido de 1.7 para evitar salto visual
        break;

      case 'highlighted':
        mat.color.setHex(orig); glow.color.setHex(orig); mid.color.setHex(orig);
        mat.opacity  = 0.95; glow.opacity = 0.22; mid.opacity  = 0.38;
        core.opacity = 0.92; core.color.setHex(0xffffff);
        mesh.scale.setScalar(1.10);
        break;

      case 'child':
        /* Hijos directos: color original brillante pero escala ligeramente reducida */
        mat.color.setHex(orig); glow.color.setHex(orig); mid.color.setHex(orig);
        mat.opacity  = 0.82; glow.opacity = 0.22; mid.opacity  = 0.32;
        core.opacity = 0.90; core.color.setHex(0xffffff);
        mesh.scale.setScalar(1.05);
        break;

      case 'grey':
        /* Reposo: blanco-azul tenue, visible pero sin destacar */
        mat.color.setHex(GREY_COLOR); glow.color.setHex(GREY_COLOR); mid.color.setHex(GREY_COLOR);
        mat.opacity  = 0.40; glow.opacity = 0.04; mid.opacity  = 0.08;
        core.opacity = 0.28; core.color.setHex(0x9aadcc);
        mesh.scale.setScalar(0.85);
        break;
    }
  }

  function _updateVisuals() {
    const hasSelection = (selectedId !== null);
    const hasFilter    = (legendFilterType !== null);
    const hasSearch    = (searchFilter !== null);

    /* ── Partículas ── */
    Object.entries(meshById).forEach(([id, mesh]) => {
      const node = REL.nodeMap.get(id);
      let state;

      if (!hasSelection && !hasFilter && !hasSearch) {
        state = 'normal';
      } else if (hasSearch) {
        state = searchFilter.has(id) ? 'normal' : 'grey';
      } else if (hasFilter) {
        state = (node && node.type === legendFilterType) ? 'normal' : 'grey';
      } else {
        // hasSelection
        if (id === selectedId)         state = 'selected';
        else if (highlightSet.has(id)) state = 'highlighted';
        else if (childSet.has(id))     state = 'child';
        else                           state = 'grey';
      }

      _applyState(mesh, state);
    });

    /* ── Líneas ── */
    Object.entries(lineByEdgeKey).forEach(([key, line]) => {
      const mat = line.material;

      if (!hasSelection && !hasFilter && !hasSearch) {
        mat.opacity = 0;
        return;
      }

      const isRelLine = key.startsWith('rel:');
      const rawKey    = isRelLine ? key.replace('rel:', '') : key;
      const [a, b]    = rawKey.split('|');

      if (hasSearch) {
        const inSearch = searchFilter.has(a) && searchFilter.has(b);
        mat.opacity = inSearch ? LINE_OPACITY_HIGHLIGHT * 0.40 : 0;
        if (inSearch) mat.color.setHex(LINE_COLOR);
        return;
      }

      if (hasFilter) {
        const nodeA = REL.nodeMap.get(a);
        const nodeB = REL.nodeMap.get(b);
        const both  = nodeA && nodeB &&
          nodeA.type === legendFilterType &&
          nodeB.type === legendFilterType;
        mat.opacity = both ? LINE_OPACITY_HIGHLIGHT * 0.50 : 0;
        if (both) mat.color.setHex(LINE_COLOR);
        return;
      }

      // hasSelection
      const aActive = (a === selectedId) || highlightSet.has(a);
      const bActive = (b === selectedId) || highlightSet.has(b);
      const aChild  = childSet.has(a);
      const bChild  = childSet.has(b);

      if (aActive && bActive) {
        /* Línea en la cadena principal: brillante */
        mat.opacity = LINE_OPACITY_HIGHLIGHT;
        mat.color.setHex(LINE_COLOR);
      } else if ((aActive && bChild) || (aChild && bActive) || (aChild && bChild)) {
        /* Línea hacia hijo: tenue, mismo color */
        mat.opacity = LINE_OPACITY_HIGHLIGHT * 0.32;
        mat.color.setHex(LINE_COLOR);
      } else {
        mat.opacity = 0;
      }
    });
  }

  /* ── Auto-rotación ───────────────────────────────────────────── */
  function rotateSphere(delta) {
    if (sphereGroup) sphereGroup.rotation.y += delta;
  }

  /* ── Raycasting ──────────────────────────────────────────────── */
  function intersectNodes(raycaster) {
    const meshes = Object.values(meshById);
    const hits   = raycaster.intersectObjects(meshes, false);
    if (hits.length === 0) return null;
    return hits[0].object.userData.nodeId || null;
  }

  /* ── API pública ─────────────────────────────────────────────── */
  return {
    build,
    selectNode,
    filterByType,
    filterBySearch,
    intersectNodes,
    rotateSphere,
    getMeshById(id)          { return meshById[id]; },
    getSphereGroup()         { return sphereGroup; },
    getSelectedId()          { return selectedId; },
    getLegendFilterType()    { return legendFilterType; },
    getSearchFilter()        { return searchFilter; },
  };
})();
