/**
 * src/js/scene.js
 * ──────────────────────────────────────────────────────────────────
 * Configuración de la escena Three.js: renderer, cámara, luces,
 * OrbitControls y loop de animación.
 *
 * Expone: window.AppScene
 * ──────────────────────────────────────────────────────────────────
 */
window.AppScene = (function () {

  /* Referencias internas */
  let renderer, camera, scene, controls;
  let wrapper;          // div#canvas-wrapper
  let animating = true; // bandera para pausar el loop si fuera necesario
  let autoRotate = true; // la esfera gira sola hasta el primer clic

  /* Callbacks externos que se ejecutan en cada frame */
  const onFrameCallbacks = [];

  /* ── init ──────────────────────────────────────────────────── */
  function init() {
    wrapper = document.getElementById('canvas-wrapper');

    /* ── Renderer ─────────────────────────────────────────── */
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(wrapper.clientWidth, wrapper.clientHeight);
    renderer.setClearColor(0x050810, 1);
    wrapper.appendChild(renderer.domElement);

    /* ── Escena ───────────────────────────────────────────── */
    scene = new THREE.Scene();

    // Niebla suave — densidad reducida para la esfera de mayor tamaño
    scene.fog = new THREE.FogExp2(0x050810, 0.009);

    /* ── Cámara ───────────────────────────────────────────── */
    const aspect = wrapper.clientWidth / wrapper.clientHeight;
    camera = new THREE.PerspectiveCamera(55, aspect, 0.1, 200);
    camera.position.set(0, 0, 22);

    /* ── Luces ────────────────────────────────────────────── */
    // Luz ambiental débil — da un tono base oscuro
    const ambient = new THREE.AmbientLight(0x1a2040, 1.5);
    scene.add(ambient);

    // Punto de luz central de color cálido — distancia ampliada para esfera mayor
    const pointCenter = new THREE.PointLight(0x4fc3f7, 1.5, 35);
    pointCenter.position.set(0, 0, 0);
    scene.add(pointCenter);

    // Punto de luz lateral
    const pointSide = new THREE.PointLight(0x7c4dff, 0.8, 50);
    pointSide.position.set(15, 8, 8);
    scene.add(pointSide);

    /* ── OrbitControls ────────────────────────────────────── */
    controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.07;
    controls.rotateSpeed = 0.5;
    controls.zoomSpeed = 0.8;
    controls.minDistance = 8;
    controls.maxDistance = 55;
    controls.enablePan = false; // sin paneo para mantener el centramiento

    // Desactivar auto-rotación solo cuando la cámara cambia realmente (drag/zoom),
    // no en un clic simple (para evitar el salto visual al seleccionar).
    controls.addEventListener('change', () => { autoRotate = false; });

    /* ── Partículas de fondo (estrellas) ──────────────────── */
    _addStars();

    /* ── Redimensionamiento ───────────────────────────────── */
    window.addEventListener('resize', _onResize);

    /* ── Loop de animación ────────────────────────────────── */
    _animate();
  }

  /* ── Estrellas de fondo ─────────────────────────────────────── */
  function _addStars() {
    const count = 3000;
    const geo = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      // Distribuir en una gran esfera exterior (más lejos que la esfera de datos)
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      const r     = 80 + Math.random() * 40;
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xaabbdd,
      size: 0.14,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.60,
    });

    scene.add(new THREE.Points(geo, mat));
  }

  /* ── Loop ───────────────────────────────────────────────────── */
  function _animate() {
    if (!animating) return;
    requestAnimationFrame(_animate);

    controls.update(); // requerido cuando enableDamping = true

    // Ejecutar callbacks registrados (partículas, interacciones, etc.)
    onFrameCallbacks.forEach(fn => fn());

    renderer.render(scene, camera);
  }

  /* ── Resize ─────────────────────────────────────────────────── */
  function _onResize() {
    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  }

  /* ── API pública ─────────────────────────────────────────────── */
  return {
    init,

    /** Accesores */
    getScene()    { return scene; },
    getCamera()   { return camera; },
    getRenderer() { return renderer; },
    getControls() { return controls; },
    getWrapper()  { return wrapper; },
    isAutoRotate(){ return autoRotate; },
    setAutoRotate(v){ autoRotate = v; },

    /**
     * Registra una función que se ejecutará en cada frame del loop.
     * @param {Function} fn
     */
    onFrame(fn) {
      onFrameCallbacks.push(fn);
    },
  };
})();
