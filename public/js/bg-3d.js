/**
 * bg-3d.js - Next-Generation Ultra-Modern 3D Interactive Background Engine
 * Features:
 *  - 3D Holographic Cyber Aurora / Undulating Digital Mesh with dual-layer lighting
 *  - Dual-layer Floating 3D Crystals (Glossy Faceted Core + Neon Wireframe Cage + Orbital Gyroscope)
 *  - 3D Twisting Torus Knot Ribbon with Metallic Specular Highlights
 *  - Interactive 3D Cursor Point Light (follows mouse with real-time dynamic specular glints)
 *  - Dynamic Mouse Wave Disturbance Field & Click Shockwave Physics
 *  - 3D Glowing Energy Spores & Constellation Starfield with procedural soft halo textures
 *  - Seamless Dark / Light Theme switching with real-time shader material adaptation
 *  - 60FPS Hardware-accelerated WebGL with battery-saving auto-pause
 */

(function () {
  'use strict';

  // Global Three.js Objects
  let scene, camera, renderer;
  let canvasEl = null;

  // 3D Visual Elements
  let waveMesh = null;
  let waveWireframe = null;
  let waveGeometry = null;
  let waveParticles = null;
  let stardustPoints = null;
  let crystalGroup = null;

  // Crystal 1: Geodesic Crystal with Outer Cage & Orbital Rings
  let crystalCore = null;
  let crystalCage = null;
  let crystalGlowPoints = null;
  let crystalOrbitRing1 = null;
  let crystalOrbitRing2 = null;

  // Crystal 2: Twisting Infinity Torus Knot
  let knotCore = null;
  let knotWire = null;

  // Crystal 3: Floating Satellite Diamond Crystals
  let satellite1 = null;
  let satellite2 = null;
  let satellite3 = null;

  // Lights
  let ambientLight = null;
  let mouseLight = null;
  let primaryLight = null;
  let secondaryLight = null;
  let rimLight = null;

  // Animation & Physics State
  let animationFrameId = null;
  let isRunning = false;
  let clock = null;
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0, worldX: 0, worldY: 0 };
  let windowHalfX = window.innerWidth / 2;
  let windowHalfY = window.innerHeight / 2;
  let shockwave = { active: false, radius: 0, maxRadius: 900, speed: 22, intensity: 0, originX: 0, originZ: 0 };
  let isDarkTheme = true;

  // Wave Grid Configuration
  const GRID_WIDTH = 1800;
  const GRID_DEPTH = 1300;
  const GRID_SEGS_X = 64;
  const GRID_SEGS_Z = 48;

  /**
   * Helper: Generate a high-quality soft halo circular glow texture in memory
   */
  function createHaloTexture(innerHex = '#ffffff', outerHex = '#06b6d4') {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.18, innerHex);
    grad.addColorStop(0.5, outerHex);
    grad.addColorStop(0.85, 'rgba(99, 102, 241, 0.15)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Always enforce dark theme
   */
  function checkIsDarkTheme() {
    return true;
  }

  /**
   * Main Initialization
   */
  function init() {
    canvasEl = document.getElementById('webgl-3d-bg');
    if (!canvasEl) return;

    if (typeof THREE === 'undefined') {
      console.warn('[3D-BG] Three.js not found. Loading fallback.');
      initFallback(canvasEl);
      return;
    }

    try {
      clock = new THREE.Clock();
      isDarkTheme = checkIsDarkTheme();

      // 1. Scene & Atmospheric Fog
      scene = new THREE.Scene();
      const fogHex = isDarkTheme ? 0x050814 : 0xe2e8f0;
      scene.fog = new THREE.FogExp2(fogHex, 0.00085);

      // 2. Camera Setup (Generous FOV for cinematic depth)
      camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 1, 4000);
      camera.position.set(0, 70, 700);

      // 3. WebGL Renderer with Alpha Support
      renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);

      // 4. Dynamic Lighting System
      setupLighting();

      // 5. Build 3D Entities
      buildDynamicWaveField();
      buildHolographicCrystals();
      buildCosmicStarfield();

      // 6. Bind Events
      window.addEventListener('resize', onResize, { passive: true });
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('pointerdown', onPointerDown, { passive: true });
      document.addEventListener('visibilitychange', onVisibility);

      // Watch for body class / theme updates
      const themeObserver = new MutationObserver(() => {
        const darkNow = checkIsDarkTheme();
        if (darkNow !== isDarkTheme) {
          isDarkTheme = darkNow;
          updateThemeColors();
        }
      });
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

      // Start 60fps Loop
      isRunning = true;
      animate();
      console.log('[3D-BG] Ultra-Modern 3D Cyber Engine initialized.');

    } catch (err) {
      console.error('[3D-BG] Init failed:', err);
      initFallback(canvasEl);
    }
  }

  /**
   * Multi-point Lighting Setup
   */
  function setupLighting() {
    ambientLight = new THREE.AmbientLight(isDarkTheme ? 0x1e1b4b : 0x94a3b8, 1.4);
    scene.add(ambientLight);

    // Dynamic mouse-following point light
    mouseLight = new THREE.PointLight(0x06b6d4, 3.5, 900, 1.2);
    mouseLight.position.set(0, 100, 300);
    scene.add(mouseLight);

    // Primary Cyber Indigo Light
    primaryLight = new THREE.PointLight(0x6366f1, 4.0, 1400, 1.1);
    primaryLight.position.set(450, 260, 200);
    scene.add(primaryLight);

    // Secondary Neon Magenta / Purple Light
    secondaryLight = new THREE.PointLight(0xec4899, 3.2, 1200, 1.2);
    secondaryLight.position.set(-450, -120, 150);
    scene.add(secondaryLight);

    // Subtle Cyan Rim Light from behind
    rimLight = new THREE.DirectionalLight(0x0ea5e9, 1.5);
    rimLight.position.set(0, 300, -400);
    scene.add(rimLight);
  }

  /**
   * 1. Dynamic Fluid 3D Wave Surface (Cyber Aurora Ocean)
   */
  function buildDynamicWaveField() {
    waveGeometry = new THREE.PlaneGeometry(GRID_WIDTH, GRID_DEPTH, GRID_SEGS_X, GRID_SEGS_Z);
    waveGeometry.rotateX(-Math.PI / 2.3);

    const pos = waveGeometry.attributes.position;
    const originalPositions = new Float32Array(pos.array.length);
    for (let i = 0; i < pos.array.length; i++) {
      originalPositions[i] = pos.array[i];
    }
    waveGeometry.userData = { originalPositions };

    // A. Translucent Shimmering Surface
    const surfaceMat = new THREE.MeshPhongMaterial({
      color: isDarkTheme ? 0x0f172a : 0xe0e7ff,
      emissive: isDarkTheme ? 0x1e1b4b : 0x4338ca,
      emissiveIntensity: isDarkTheme ? 0.35 : 0.15,
      specular: 0x06b6d4,
      shininess: 60,
      transparent: true,
      opacity: isDarkTheme ? 0.72 : 0.45,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    waveMesh = new THREE.Mesh(waveGeometry, surfaceMat);
    waveMesh.position.set(0, -130, -50);
    scene.add(waveMesh);

    // B. Luminous Wireframe Overlay on top of surface
    const wireMat = new THREE.MeshBasicMaterial({
      color: isDarkTheme ? 0x6366f1 : 0x4f46e5,
      wireframe: true,
      transparent: true,
      opacity: isDarkTheme ? 0.45 : 0.25,
      depthWrite: false
    });
    waveWireframe = new THREE.Mesh(waveGeometry, wireMat);
    waveWireframe.position.copy(waveMesh.position);
    scene.add(waveWireframe);

    // C. Glowing Node Points at vertices
    const particleMat = new THREE.PointsMaterial({
      color: isDarkTheme ? 0x22d3ee : 0x6366f1,
      size: isDarkTheme ? 7.5 : 5.5,
      map: createHaloTexture('#22d3ee', '#6366f1'),
      transparent: true,
      opacity: isDarkTheme ? 0.85 : 0.4,
      blending: isDarkTheme ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    });
    waveParticles = new THREE.Points(waveGeometry, particleMat);
    waveParticles.position.copy(waveMesh.position);
    scene.add(waveParticles);
  }

  /**
   * 2. Holographic Floating 3D Cyber Crystals & Sculptures
   */
  function buildHolographicCrystals() {
    crystalGroup = new THREE.Group();

    // ==========================================
    // A. HERO CRYSTAL 1 (Right Side): Faceted Geodesic Gem + Neon Cage + Orbit Rings
    // ==========================================
    const icosaGeom = new THREE.IcosahedronGeometry(110, 1);

    // 1. Inner Shiny Faceted Crystal Core
    const coreMat = new THREE.MeshPhongMaterial({
      color: isDarkTheme ? 0x1e1b4b : 0x4f46e5,
      emissive: isDarkTheme ? 0x312e81 : 0x3730a3,
      emissiveIntensity: 0.6,
      specular: 0x38bdf8,
      shininess: 100,
      flatShading: true,
      transparent: true,
      opacity: isDarkTheme ? 0.85 : 0.6
    });
    crystalCore = new THREE.Mesh(icosaGeom, coreMat);
    crystalCore.position.set(410, 70, -60);
    crystalGroup.add(crystalCore);

    // 2. Outer Glowing Neon Wireframe Cage
    const cageGeom = new THREE.IcosahedronGeometry(118, 1);
    const cageWireGeom = new THREE.WireframeGeometry(cageGeom);
    const cageMat = new THREE.LineBasicMaterial({
      color: isDarkTheme ? 0x38bdf8 : 0x0284c7,
      transparent: true,
      opacity: isDarkTheme ? 0.85 : 0.45,
      linewidth: 2
    });
    crystalCage = new THREE.LineSegments(cageWireGeom, cageMat);
    crystalCage.position.copy(crystalCore.position);
    crystalGroup.add(crystalCage);

    // 3. Glowing Vertex Halo Points
    const glowPointsMat = new THREE.PointsMaterial({
      color: 0x06b6d4,
      size: isDarkTheme ? 10 : 7,
      map: createHaloTexture('#06b6d4', '#6366f1'),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    crystalGlowPoints = new THREE.Points(cageGeom, glowPointsMat);
    crystalGlowPoints.position.copy(crystalCore.position);
    crystalGroup.add(crystalGlowPoints);

    // 4. Concentric Orbital Gyro Rings around Hero Crystal
    const ringMat = new THREE.LineBasicMaterial({
      color: isDarkTheme ? 0x818cf8 : 0x4f46e5,
      transparent: true,
      opacity: isDarkTheme ? 0.6 : 0.3
    });
    crystalOrbitRing1 = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.TorusGeometry(155, 1.2, 8, 64)),
      ringMat
    );
    crystalOrbitRing1.position.copy(crystalCore.position);
    crystalGroup.add(crystalOrbitRing1);

    crystalOrbitRing2 = new THREE.LineSegments(
      new THREE.WireframeGeometry(new THREE.TorusGeometry(180, 1.2, 8, 64)),
      new THREE.LineBasicMaterial({
        color: isDarkTheme ? 0xec4899 : 0xdb2777,
        transparent: true,
        opacity: isDarkTheme ? 0.5 : 0.25
      })
    );
    crystalOrbitRing2.position.copy(crystalCore.position);
    crystalGroup.add(crystalOrbitRing2);

    // ==========================================
    // B. HERO CRYSTAL 2 (Left Side): Twisting Metallic Torus Knot
    // ==========================================
    const knotGeom = new THREE.TorusKnotGeometry(78, 20, 100, 18);
    const knotMat = new THREE.MeshPhongMaterial({
      color: isDarkTheme ? 0x581c87 : 0x6d28d9,
      emissive: isDarkTheme ? 0x7e22ce : 0x4c1d95,
      emissiveIntensity: 0.5,
      specular: 0xf472b6,
      shininess: 90,
      transparent: true,
      opacity: isDarkTheme ? 0.8 : 0.55
    });
    knotCore = new THREE.Mesh(knotGeom, knotMat);
    knotCore.position.set(-420, -30, -90);
    crystalGroup.add(knotCore);

    const knotWireGeom = new THREE.WireframeGeometry(knotGeom);
    const knotWireMat = new THREE.LineBasicMaterial({
      color: isDarkTheme ? 0xf472b6 : 0xd946ef,
      transparent: true,
      opacity: isDarkTheme ? 0.75 : 0.35
    });
    knotWire = new THREE.LineSegments(knotWireGeom, knotWireMat);
    knotWire.position.copy(knotCore.position);
    crystalGroup.add(knotWire);

    // ==========================================
    // C. SATELLITE CRYSTALS (Floating Octahedrons)
    // ==========================================
    const satGeom = new THREE.OctahedronGeometry(36, 0);
    const satMat1 = new THREE.MeshPhongMaterial({
      color: 0x059669,
      emissive: 0x10b981,
      emissiveIntensity: 0.6,
      specular: 0x34d399,
      flatShading: true,
      transparent: true,
      opacity: 0.8
    });
    satellite1 = new THREE.Mesh(satGeom, satMat1);
    satellite1.position.set(-220, 190, -40);
    crystalGroup.add(satellite1);

    const satMat2 = new THREE.MeshPhongMaterial({
      color: 0xd97706,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.6,
      specular: 0xfbbf24,
      flatShading: true,
      transparent: true,
      opacity: 0.8
    });
    satellite2 = new THREE.Mesh(satGeom, satMat2);
    satellite2.position.set(220, 220, -70);
    crystalGroup.add(satellite2);

    const satMat3 = new THREE.MeshPhongMaterial({
      color: 0x0284c7,
      emissive: 0x0ea5e9,
      emissiveIntensity: 0.6,
      specular: 0x38bdf8,
      flatShading: true,
      transparent: true,
      opacity: 0.8
    });
    satellite3 = new THREE.Mesh(new THREE.OctahedronGeometry(26, 0), satMat3);
    satellite3.position.set(0, -180, 50);
    crystalGroup.add(satellite3);

    scene.add(crystalGroup);
  }

  /**
   * 3. Ambient Cosmic Energy Starfield & Nebula Spores
   */
  function buildCosmicStarfield() {
    const starCount = 550;
    const geometry = new THREE.BufferGeometry();
    const coords = new Float32Array(starCount * 3);
    const colors = new Float32Array(starCount * 3);
    const sizes = new Float32Array(starCount);

    const colIndigo = new THREE.Color(0x818cf8);
    const colCyan = new THREE.Color(0x38bdf8);
    const colPink = new THREE.Color(0xf472b6);
    const colWhite = new THREE.Color(0xffffff);

    for (let i = 0; i < starCount; i++) {
      coords[i * 3] = (Math.random() - 0.5) * 1900;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 1300 + 40;
      coords[i * 3 + 2] = (Math.random() - 0.5) * 1400;

      const rnd = Math.random();
      const col = rnd < 0.35 ? colCyan : (rnd < 0.65 ? colIndigo : (rnd < 0.88 ? colPink : colWhite));
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;

      sizes[i] = Math.random() * 8 + 4;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(coords, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const starMaterial = new THREE.PointsMaterial({
      size: isDarkTheme ? 8.5 : 6,
      map: createHaloTexture('#ffffff', '#38bdf8'),
      vertexColors: true,
      transparent: true,
      opacity: isDarkTheme ? 0.9 : 0.5,
      blending: isDarkTheme ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    });

    stardustPoints = new THREE.Points(geometry, starMaterial);
    scene.add(stardustPoints);
  }

  /**
   * Dynamic Theme Transitioning (Dark / Light)
   */
  function updateThemeColors() {
    if (!scene) return;
    const dark = isDarkTheme;

    // Atmospheric Fog
    scene.fog.color.setHex(dark ? 0x050814 : 0xe2e8f0);

    // Lights
    if (ambientLight) ambientLight.color.setHex(dark ? 0x1e1b4b : 0x94a3b8);
    if (primaryLight) primaryLight.intensity = dark ? 4.0 : 2.5;
    if (secondaryLight) secondaryLight.intensity = dark ? 3.2 : 2.0;

    // Wave Mesh Surface
    if (waveMesh) {
      waveMesh.material.color.setHex(dark ? 0x0f172a : 0xe0e7ff);
      waveMesh.material.emissive.setHex(dark ? 0x1e1b4b : 0x4338ca);
      waveMesh.material.opacity = dark ? 0.72 : 0.45;
    }
    if (waveWireframe) {
      waveWireframe.material.color.setHex(dark ? 0x6366f1 : 0x4f46e5);
      waveWireframe.material.opacity = dark ? 0.45 : 0.25;
    }
    if (waveParticles) {
      waveParticles.material.color.setHex(dark ? 0x22d3ee : 0x6366f1);
      waveParticles.material.opacity = dark ? 0.85 : 0.4;
      waveParticles.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    }

    // Hero Crystals
    if (crystalCore) {
      crystalCore.material.color.setHex(dark ? 0x1e1b4b : 0x4f46e5);
      crystalCore.material.emissive.setHex(dark ? 0x312e81 : 0x3730a3);
      crystalCore.material.opacity = dark ? 0.85 : 0.6;
    }
    if (crystalCage) {
      crystalCage.material.color.setHex(dark ? 0x38bdf8 : 0x0284c7);
      crystalCage.material.opacity = dark ? 0.85 : 0.45;
    }
    if (knotCore) {
      knotCore.material.color.setHex(dark ? 0x581c87 : 0x6d28d9);
      knotCore.material.emissive.setHex(dark ? 0x7e22ce : 0x4c1d95);
      knotCore.material.opacity = dark ? 0.8 : 0.55;
    }
    if (knotWire) {
      knotWire.material.color.setHex(dark ? 0xf472b6 : 0xd946ef);
      knotWire.material.opacity = dark ? 0.75 : 0.35;
    }

    // Stardust
    if (stardustPoints) {
      stardustPoints.material.opacity = dark ? 0.9 : 0.5;
      stardustPoints.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
    }
  }

  /**
   * Mouse Motion Handling
   */
  function onMouseMove(e) {
    mouse.targetX = (e.clientX - windowHalfX) * 0.45;
    mouse.targetY = (e.clientY - windowHalfY) * 0.4;

    // Convert mouse position to approximate 3D world coordinates for dynamic point light
    mouse.worldX = (e.clientX / window.innerWidth) * 1000 - 500;
    mouse.worldY = -(e.clientY / window.innerHeight) * 600 + 300;
  }

  /**
   * Pointer Click Shockwave
   */
  function onPointerDown(e) {
    shockwave.active = true;
    shockwave.radius = 15;
    shockwave.intensity = 85;
    shockwave.originX = mouse.worldX;
    shockwave.originZ = 0;
  }

  /**
   * Window Resize
   */
  function onResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;
    if (camera && renderer) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Visibility Change Optimization
   */
  function onVisibility() {
    if (document.hidden) {
      isRunning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    } else {
      isRunning = true;
      if (clock) clock.getDelta();
      animate();
    }
  }

  /**
   * Main 60FPS Physics & Render Loop
   */
  function animate() {
    if (!isRunning) return;
    animationFrameId = requestAnimationFrame(animate);

    const elapsed = clock ? clock.getElapsedTime() : Date.now() * 0.001;

    // 1. Smooth Camera Parallax Lerp
    mouse.x += (mouse.targetX - mouse.x) * 0.045;
    mouse.y += (mouse.targetY - mouse.y) * 0.045;

    camera.position.x = mouse.x * 0.95;
    camera.position.y = 70 - mouse.y * 0.75;
    camera.lookAt(0, 10, -120);

    // 2. Animate Mouse Follower Light
    if (mouseLight) {
      mouseLight.position.x += (mouse.worldX - mouseLight.position.x) * 0.08;
      mouseLight.position.y += (mouse.worldY - mouseLight.position.y) * 0.08;
    }

    // 3. Dynamic Wave Field Vertex Manipulation
    if (waveGeometry) {
      const pos = waveGeometry.attributes.position;
      const original = waveGeometry.userData.originalPositions;

      // Expand Click Shockwave
      if (shockwave.active) {
        shockwave.radius += shockwave.speed;
        shockwave.intensity *= 0.96;
        if (shockwave.radius > shockwave.maxRadius || shockwave.intensity < 0.8) {
          shockwave.active = false;
        }
      }

      const pCount = pos.count;
      for (let i = 0; i < pCount; i++) {
        const ox = original[i * 3];
        const oy = original[i * 3 + 1];
        const oz = original[i * 3 + 2];

        // Harmonic dual traveling sine waves with spatial curvature
        const distFromCenter = Math.sqrt(ox * ox + oz * oz) * 0.003;
        const mainWave = Math.sin(ox * 0.0075 + elapsed * 1.6) * 35 * Math.cos(distFromCenter);
        const crossWave = Math.cos(oz * 0.009 + elapsed * 1.3) * 28;
        const microRipple = Math.sin((ox + oz) * 0.012 + elapsed * 2.2) * 14;

        let shockOffset = 0;
        if (shockwave.active) {
          const dx = ox - shockwave.originX;
          const dz = oz - shockwave.originZ;
          const d = Math.sqrt(dx * dx + dz * dz);
          const diff = Math.abs(d - shockwave.radius);
          if (diff < 90) {
            shockOffset = Math.sin((1 - diff / 90) * Math.PI) * shockwave.intensity;
          }
        }

        // Apply mouse disturbance elevation
        const mDist = Math.hypot(ox - mouse.worldX, oz);
        let mouseHoverElevation = 0;
        if (mDist < 260) {
          mouseHoverElevation = Math.cos((mDist / 260) * (Math.PI / 2)) * 25;
        }

        pos.setY(i, oy + mainWave + crossWave + microRipple + shockOffset + mouseHoverElevation);
      }
      pos.needsUpdate = true;
      waveGeometry.computeVertexNormals();
    }

    // 4. Animate Hero Crystal 1 (Geodesic Gem + Cage + Gyro Rings)
    if (crystalCore && crystalCage) {
      const rotSpeedX = 0.006;
      const rotSpeedY = 0.008;

      crystalCore.rotation.x += rotSpeedX;
      crystalCore.rotation.y += rotSpeedY;
      crystalCage.rotation.x = crystalCore.rotation.x;
      crystalCage.rotation.y = crystalCore.rotation.y;

      const floatY = 70 + Math.sin(elapsed * 1.4) * 20;
      crystalCore.position.y = floatY;
      crystalCage.position.y = floatY;

      if (crystalGlowPoints) {
        crystalGlowPoints.rotation.copy(crystalCore.rotation);
        crystalGlowPoints.position.y = floatY;
      }

      if (crystalOrbitRing1 && crystalOrbitRing2) {
        crystalOrbitRing1.position.y = floatY;
        crystalOrbitRing1.rotation.x += 0.012;
        crystalOrbitRing1.rotation.y += 0.008;

        crystalOrbitRing2.position.y = floatY;
        crystalOrbitRing2.rotation.y += 0.015;
        crystalOrbitRing2.rotation.z += 0.01;
      }
    }

    // 5. Animate Hero Crystal 2 (Twisting Torus Knot Ribbon)
    if (knotCore && knotWire) {
      knotCore.rotation.x += 0.007;
      knotCore.rotation.z += 0.005;
      knotWire.rotation.copy(knotCore.rotation);

      const knotFloatY = -30 + Math.cos(elapsed * 1.2) * 18;
      knotCore.position.y = knotFloatY;
      knotWire.position.y = knotFloatY;
    }

    // 6. Animate Orbiting Satellites
    if (satellite1) {
      satellite1.rotation.x += 0.012;
      satellite1.rotation.y += 0.015;
      satellite1.position.y = 190 + Math.sin(elapsed * 1.8) * 15;
    }
    if (satellite2) {
      satellite2.rotation.y -= 0.014;
      satellite2.rotation.z += 0.01;
      satellite2.position.y = 220 + Math.cos(elapsed * 1.6) * 16;
    }
    if (satellite3) {
      satellite3.rotation.x -= 0.01;
      satellite3.rotation.z -= 0.012;
      satellite3.position.x = Math.sin(elapsed * 0.8) * 120;
      satellite3.position.y = -180 + Math.cos(elapsed * 1.5) * 12;
    }

    // 7. Animate Cosmic Starfield
    if (stardustPoints) {
      stardustPoints.rotation.y = elapsed * 0.02;
      stardustPoints.rotation.x = Math.sin(elapsed * 0.01) * 0.04;
    }

    // 8. Render
    renderer.render(scene, camera);
  }

  /**
   * Robust 2D Fallback Engine
   */
  function initFallback(canvas) {
    const ctx = canvas.getContext('2d');
    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    });

    const pts = Array.from({ length: 90 }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.7,
      vy: (Math.random() - 0.5) * 0.7,
      size: Math.random() * 2.5 + 1.5
    }));

    function loop() {
      ctx.clearRect(0, 0, w, h);
      const isDark = checkIsDarkTheme();
      ctx.fillStyle = isDark ? 'rgba(99, 102, 241, 0.7)' : 'rgba(79, 70, 229, 0.4)';
      ctx.strokeStyle = isDark ? 'rgba(6, 182, 212, 0.18)' : 'rgba(99, 102, 241, 0.12)';

      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        p.x = (p.x + p.vx + w) % w;
        p.y = (p.y + p.vy + h) % h;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();

        for (let j = i + 1; j < pts.length; j++) {
          const p2 = pts[j];
          const d = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (d < 140) {
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(loop);
    }
    loop();
  }

  // Boot on ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API
  window.Portal3DBackground = {
    triggerPulse: onPointerDown,
    refreshTheme: updateThemeColors
  };

})();
