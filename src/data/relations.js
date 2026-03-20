/**
 * src/data/relations.js
 * ──────────────────────────────────────────────────────────────────
 * Construye el grafo de relaciones a partir de los datos de nodes.js.
 *
 * Expone window.APP_RELATIONS con:
 *   - childrenMap  : Map<parentId, childId[]>
 *   - parentMap    : Map<childId, parentId>
 *   - nodeMap      : Map<id, nodeObject>
 *   - getAncestors : (nodeId) => nodeObject[]  — del más cercano al más lejano
 *   - getChildren  : (nodeId) => nodeObject[]
 *   - getSiblings  : (nodeId) => nodeObject[]
 *   - getPath      : (nodeId) => nodeObject[]  — [root, …, node]
 * ──────────────────────────────────────────────────────────────────
 */
window.APP_RELATIONS = (function () {
  const { nodes } = window.APP_DATA;

  /* ── Índices ────────────────────────────────────────────────── */
  /** Map<id, node> */
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  /** Map<parentId, childId[]> */
  const childrenMap = new Map();

  /** Map<childId, parentId> */
  const parentMap = new Map();

  nodes.forEach(node => {
    if (node.parentId) {
      parentMap.set(node.id, node.parentId);
      if (!childrenMap.has(node.parentId)) childrenMap.set(node.parentId, []);
      childrenMap.get(node.parentId).push(node.id);
    }
  });

  /* ── Relaciones explícitas de artículos ─────────────────────── */
  // (relacionDirecta ya está en el nodo; aquí construimos el índice inverso)
  /** Map<targetId, articuloId[]> */
  const articulosByTarget = new Map();
  nodes
    .filter(n => n.type === 'articulo' && n.relacionDirecta)
    .forEach(art => {
      const tid = art.relacionDirecta;
      if (!articulosByTarget.has(tid)) articulosByTarget.set(tid, []);
      articulosByTarget.get(tid).push(art.id);
    });

  /* ── Funciones de consulta ──────────────────────────────────── */

  /**
   * Devuelve el array de nodos ancestros desde el padre inmediato hasta la raíz.
   * [padre, abuelo, ..., raíz]
   */
  function getAncestors(nodeId) {
    const result = [];
    let current = parentMap.get(nodeId);
    while (current) {
      result.push(nodeMap.get(current));
      current = parentMap.get(current);
    }
    return result;
  }

  /**
   * Devuelve el camino completo desde la raíz hasta el nodo.
   * [raíz, ..., padre, nodo]
   */
  function getPath(nodeId) {
    const ancestors = getAncestors(nodeId).reverse();
    const self = nodeMap.get(nodeId);
    return self ? [...ancestors, self] : ancestors;
  }

  /** Devuelve los hijos directos de un nodo. */
  function getChildren(nodeId) {
    return (childrenMap.get(nodeId) || []).map(id => nodeMap.get(id));
  }

  /**
   * Devuelve los hermanos del nodo (mismos hijos del mismo padre),
   * excluyendo el propio nodo.
   */
  function getSiblings(nodeId) {
    const pid = parentMap.get(nodeId);
    if (!pid) return [];
    return (childrenMap.get(pid) || [])
      .filter(id => id !== nodeId)
      .map(id => nodeMap.get(id));
  }

  /**
   * Devuelve todos los artículos relacionados directamente con un nodo.
   */
  function getRelatedArticulos(nodeId) {
    return (articulosByTarget.get(nodeId) || []).map(id => nodeMap.get(id));
  }

  /**
   * Devuelve todos los IDs involucrados en el "camino resaltado" al
   * seleccionar un nodo:
   *  - el propio nodo
   *  - todos sus ancestros
   *  - sus hermanos directos
   *  - sus hijos directos
   */
  function getHighlightSet(nodeId) {
    const set = new Set();
    set.add(nodeId);
    getAncestors(nodeId).forEach(n => set.add(n.id));
    getSiblings(nodeId).forEach(n => set.add(n.id));
    getChildren(nodeId).forEach(n => set.add(n.id));
    return set;
  }

  return {
    nodeMap,
    childrenMap,
    parentMap,
    articulosByTarget,
    getAncestors,
    getPath,
    getChildren,
    getSiblings,
    getRelatedArticulos,
    getHighlightSet,
  };
})();
