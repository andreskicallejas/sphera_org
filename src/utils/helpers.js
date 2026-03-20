/**
 * src/utils/helpers.js
 * ──────────────────────────────────────────────────────────────────
 * Funciones de utilidad puras: geometría esférica, colores, etc.
 * ──────────────────────────────────────────────────────────────────
 */
window.AppHelpers = (function () {

  /**
   * Distribución de Fibonacci sobre la superficie de una esfera.
   * Genera `count` puntos distribuidos de forma casi uniforme.
   *
   * @param {number} count  - número de puntos
   * @param {number} radius - radio de la esfera
   * @returns {THREE.Vector3[]}
   */
  function fibonacciSphere(count, radius) {
    const pts = [];
    const goldenAngle = Math.PI * (3 - Math.sqrt(5)); // ≈ 2.399 rad
    // Jitter: dispersión leve para aspecto orgánico conservando capas esféricas
    const jitterFactor = 0.10;

    for (let i = 0; i < count; i++) {
      // y va de +1 a -1 uniformemente
      const y = 1 - (i / Math.max(count - 1, 1)) * 2;
      const r = Math.sqrt(Math.max(0, 1 - y * y));
      const theta = goldenAngle * i;

      // Dispersión aleatoria por eje (preserva la capa radial aprox.)
      const jx = (Math.random() - 0.5) * 2 * jitterFactor;
      const jy = (Math.random() - 0.5) * 2 * jitterFactor;
      const jz = (Math.random() - 0.5) * 2 * jitterFactor;

      pts.push(new THREE.Vector3(
        (r * Math.cos(theta) + jx) * radius,
        (y                  + jy) * radius,
        (r * Math.sin(theta) + jz) * radius,
      ));
    }
    return pts;
  }

  /**
   * Asigna posiciones en la esfera a un array de nodos del mismo tipo.
   * Si hay un solo nodo del tipo 'empresa' lo ubica en el origen (radio 0).
   *
   * @param {object[]} nodesOfType  - nodos del mismo type
   * @param {number}   radius       - radio de la capa
   * @returns {THREE.Vector3[]}      - posiciones en el mismo orden
   */
  function positionsForLayer(nodesOfType, radius) {
    const count = nodesOfType.length;
    if (count === 0) return [];
    if (count === 1) return [new THREE.Vector3(0, 0, 0).multiplyScalar(radius)];
    return fibonacciSphere(count, radius);
  }

  /**
   * Convierte un color hex (0xRRGGBB) a string CSS "#rrggbb".
   */
  function hexToCss(hex) {
    return '#' + hex.toString(16).padStart(6, '0');
  }

  /**
   * Crea objeto de color Three.js a partir de hex numérico.
   */
  function color(hex) {
    return new THREE.Color(hex);
  }

  /**
   * Interpola linealmente entre a y b por t ∈ [0,1].
   */
  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  /**
   * Devuelve el label legible de un tipo de nodo.
   */
  function typeLabel(type) {
    return (window.APP_DATA.LEVEL_META[type] || {}).label || type;
  }

  /**
   * Devuelve el color CSS de un tipo de nodo.
   */
  function typeColor(type) {
    const hex = (window.APP_DATA.LEVEL_META[type] || {}).color || 0xffffff;
    return hexToCss(hex);
  }

  /**
   * Trunca un texto a `maxLen` caracteres añadiendo "…" si es necesario.
   */
  function truncate(text, maxLen = 60) {
    if (!text || text.length <= maxLen) return text || '';
    return text.slice(0, maxLen - 1) + '…';
  }

  /**
   * Formatea un array de IDs de segmento/familia como lista legible
   * usando los diccionarios de APP_DATA.
   */
  function formatSegmentos(ids) {
    if (!ids || ids.length === 0) return '—';
    return ids
      .map(id => {
        const s = window.APP_DATA.segmentos.find(x => x.id === id);
        return s ? s.label : id;
      })
      .join(', ');
  }

  function formatFamilias(ids) {
    if (!ids || ids.length === 0) return '—';
    return ids
      .map(id => {
        const f = window.APP_DATA.familias.find(x => x.id === id);
        return f ? f.label : id;
      })
      .join(', ');
  }

  /**
   * Devuelve el label del tipo de artículo.
   */
  function formatTipoArticulo(tipo) {
    if (!tipo) return '—';
    const t = window.APP_DATA.tiposArticulo.find(x => x.id === tipo);
    return t ? t.label : tipo;
  }

  return {
    fibonacciSphere,
    positionsForLayer,
    hexToCss,
    color,
    lerp,
    typeLabel,
    typeColor,
    truncate,
    formatSegmentos,
    formatFamilias,
    formatTipoArticulo,
  };
})();
