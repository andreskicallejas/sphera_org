/**
 * src/js/main.js
 * ──────────────────────────────────────────────────────────────────
 * Punto de entrada de la aplicación.
 * Inicializa todos los módulos en el orden correcto y arranca
 * el loop de animación.
 *
 * CÓMO EVOLUCIONARLO HACIA DATOS REALES:
 *   1. Carga los datos desde tu API antes de llamar a init():
 *        const res = await fetch('/api/nodes');
 *        window.APP_DATA.nodes = await res.json();
 *   2. Vuelve a llamar APP_RELATIONS para reconstruir los índices.
 *   3. El resto del código funciona sin cambios.
 * ──────────────────────────────────────────────────────────────────
 */
(function () {
  'use strict';

  /* ── Esperar a que el DOM esté listo ─────────────────────────── */
  document.addEventListener('DOMContentLoaded', function () {

    /* ── 1. Inicializar módulos de UI (no dependen de Three.js) ─ */
    AppUI.init();
    AppFlowchart.init();

    /* ── 2. Inicializar la escena Three.js ───────────────────── */
    AppScene.init();

    /* ── 3. Construir las partículas en la escena ─────────────── */
    AppParticles.build(AppScene.getScene());

    /* ── 4. Registrar interacciones del mouse ─────────────────── */
    AppInteractions.init();

    /* ── 5. Auto-rotación suave de la esfera ─────────────────── */
    AppScene.onFrame(function () {
      if (AppScene.isAutoRotate()) {
        AppParticles.rotateSphere(0.0015);
      }
    });

    /* ── 6. Ocultar el loading overlay ───────────────────────── */
    // Pequeño delay para que el primer frame ya esté renderizado
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        const overlay = document.getElementById('loading-overlay');
        overlay.classList.add('hidden');
        // Eliminarlo del DOM tras la transición
        setTimeout(() => overlay.remove(), 600);
      });
    });

    console.log(
      '%cSpheraOrg 3D%c — Visualización Financiera cargada.\n' +
      '%c' + window.APP_DATA.nodes.length + ' nodos%c — ' +
      'Click en cualquier partícula para explorar.',
      'color:#4fc3f7;font-weight:700;font-size:14px',
      'color:#8892b0;font-size:12px',
      'color:#FFD700;font-weight:700',
      'color:#8892b0',
    );
  });
})();
