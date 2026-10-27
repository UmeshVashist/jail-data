/**
 * bg-3d.js - Interactive Modern 3D Animated Background Engine
 * Features:
 *  - High-performance Three.js WebGL 3D Scene
 *  - Dynamic 3D Undulating Particle Wave / Digital Mesh
 *  - Floating 3D Holographic Geometries (Icosahedron, Torus Knot, Gyroscopic Rings, Octahedron)
 *  - Ethereal Glowing Stardust / Constellation Particles with procedural soft-glow textures
 *  - Interactive Mouse Parallax, Camera Lerping & Click Shockwave Physics
 *  - Real-time Light & Dark Theme Adaptation
 *  - Zero-lag Performance with Tab Visibility Optimization & Canvas 3D Fallback
 */

(function () {
  'use strict';

  // Global State
  let scene, camera, renderer;
  let canvasEl = null;
  let waveParticles = null;
  let waveGeometry = null;
  let stardustParticles = null;
  let geomGroup = null;
  let icosahedronMesh = null;
  let icosahedronPoints = null;
  let torusKnotMesh = null;
  let gyroRing1 = null;
  let gyroRing2 = null;
  let gyroRing3 = null;
  let octahedronMesh = null;
  let ambientLight, pointLight1, pointLight2;

  // Animation & Physics State
  let animationFrameId = null;
  let isRunning = false;
  let clock = null;
  let mouse = { x: 0, y: 0, targetX: 0, targetY: 0 };
  let windowHalfX = window.innerWidth / 2;
  let windowHalfY = window.innerHeight / 2;
  let shockwave = { active: false, radius: 0, maxRadius: 700, speed: 18, intensity: 0 };
  let isDarkTheme = false;

  // Wave Grid Configuration
  const GRID_SEGS_X = 50;
  const GRID_SEGS_Z = 45;
  const GRID_SPACING = 38;
  const TOTAL_GRID_POINTS = GRID_SEGS_X * GRID_SEGS_Z;

  /**
   * Helper: Generate a smooth circular radial-glow texture in-memory (no image files needed)
   */
  function createParticleGlowTexture(colorHex = '#ffffff') {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
    gradient.addColorStop(0.2, colorHex);
    gradient.addColorStop(0.55, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 64, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  /**
   * Check if current page is in dark theme
   */
  function checkIsDarkTheme() {
    return document.body.classList.contains('dark-theme') || 
           document.getElementById('login-view') && !document.getElementById('login-view').classList.contains('d-none');
  }

  /**
   * Initialize Three.js 3D Background Engine
   */
  function init3DBackground() {
    canvasEl = document.getElementById('webgl-3d-bg');
    if (!canvasEl) {
      console.warn('[3D-BG] Canvas #webgl-3d-bg not found in DOM.');
      return;
    }

    // Check if THREE is available
    if (typeof THREE === 'undefined') {
      console.warn('[3D-BG] Three.js not loaded. Falling back to Canvas 2.5D constellation.');
      initFallback2DCanvas(canvasEl);
      return;
    }

    try {
      clock = new THREE.Clock();
      isDarkTheme = checkIsDarkTheme();

      // 1. Scene
      scene = new THREE.Scene();
      const fogColor = isDarkTheme ? 0x080c18 : 0xf1f5f9;
      scene.fog = new THREE.FogExp2(fogColor, 0.0009);

      // 2. Camera (Wide angle for atmospheric perspective)
      camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 1, 3500);
      camera.position.set(0, 60, 620);

      // 3. Renderer with transparent background to preserve theme gradients
      renderer = new THREE.WebGLRenderer({
        canvas: canvasEl,
        antialias: true,
        alpha: true,
        powerPreference: 'high-performance'
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setClearColor(0x000000, 0);

      // 4. Lights
      ambientLight = new THREE.AmbientLight(isDarkTheme ? 0x312e81 : 0x818cf8, 1.2);
      scene.add(ambientLight);

      pointLight1 = new THREE.PointLight(0x6366f1, 2.5, 1200);
      pointLight1.position.set(300, 200, 200);
      scene.add(pointLight1);

      pointLight2 = new THREE.PointLight(0x06b6d4, 2.2, 1200);
      pointLight2.position.set(-300, -100, 150);
      scene.add(pointLight2);

      // 5. Build 3D Components
      buildWaveMesh();
      buildStardust();
      buildFloatingGeometries();

      // 6. Event Listeners
      window.addEventListener('resize', onWindowResize, { passive: true });
      window.addEventListener('mousemove', onMouseMove, { passive: true });
      window.addEventListener('pointerdown', onPointerDown, { passive: true });
      document.addEventListener('visibilitychange', onVisibilityChange);

      // Listen for theme changes on body
      const themeObserver = new MutationObserver(() => {
        const currentDark = checkIsDarkTheme();
        if (currentDark !== isDarkTheme) {
          isDarkTheme = currentDark;
          applyThemeColors();
        }
      });
      themeObserver.observe(document.body, { attributes: true, attributeFilter: ['class'] });

      // Start rendering loop
      isRunning = true;
      animate();
      console.log('[3D-BG] Modern 3D WebGL background initialized successfully.');

    } catch (err) {
      console.error('[3D-BG] Error initializing Three.js:', err);
      initFallback2DCanvas(canvasEl);
    }
  }

  /**
   * 1. 3D Dynamic Undulating Wave Particle Field
   */
  function buildWaveMesh() {
    waveGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(TOTAL_GRID_POINTS * 3);
    const originalPositions = new Float32Array(TOTAL_GRID_POINTS * 3);

    const startX = -((GRID_SEGS_X - 1) * GRID_SPACING) / 2;
    const startZ = -((GRID_SEGS_Z - 1) * GRID_SPACING) / 2;

    let idx = 0;
    for (let iz = 0; iz < GRID_SEGS_Z; iz++) {
      for (let ix = 0; ix < GRID_SEGS_X; ix++) {
        const x = startX + ix * GRID_SPACING;
        const y = -140; // Base baseline height
        const z = startZ + iz * GRID_SPACING;

        positions[idx * 3] = x;
        positions[idx * 3 + 1] = y;
        positions[idx * 3 + 2] = z;

        originalPositions[idx * 3] = x;
        originalPositions[idx * 3 + 1] = y;
        originalPositions[idx * 3 + 2] = z;

        idx++;
      }
    }

    waveGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    waveGeometry.userData = { originalPositions };

    const glowTex = createParticleGlowTexture('#06b6d4');
    const waveMaterial = new THREE.PointsMaterial({
      color: isDarkTheme ? 0x6366f1 : 0x4f46e5,
      size: isDarkTheme ? 13 : 9,
      map: glowTex,
      transparent: true,
      opacity: isDarkTheme ? 0.9 : 0.45,
      blending: isDarkTheme ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    });

    waveParticles = new THREE.Points(waveGeometry, waveMaterial);
    waveParticles.position.y = -80;
    waveParticles.rotation.x = 0.32; // Subtle isometric tilt
    scene.add(waveParticles);
  }

  /**
   * 2. Ambient Floating 3D Stardust / Constellations
   */
  function buildStardust() {
    const particleCount = 450;
    const geometry = new THREE.BufferGeometry();
    const coords = new Float32Array(particleCount * 3);
    const colors = new Float32Array(particleCount * 3);

    const color1 = new THREE.Color(0x818cf8); // Bright Indigo
    const color2 = new THREE.Color(0x22d3ee); // Bright Cyan
    const color3 = new THREE.Color(0xc084fc); // Bright Violet

    for (let i = 0; i < particleCount; i++) {
      coords[i * 3] = (Math.random() - 0.5) * 1600;
      coords[i * 3 + 1] = (Math.random() - 0.5) * 1100 + 40;
      coords[i * 3 + 2] = (Math.random() - 0.5) * 1200;

      const mixed = Math.random() < 0.45 ? color1 : (Math.random() < 0.5 ? color2 : color3);
      colors[i * 3] = mixed.r;
      colors[i * 3 + 1] = mixed.g;
      colors[i * 3 + 2] = mixed.b;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(coords, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const glowTex = createParticleGlowTexture('#ffffff');
    const material = new THREE.PointsMaterial({
      size: isDarkTheme ? 9 : 6.5,
      map: glowTex,
      vertexColors: true,
      transparent: true,
      opacity: isDarkTheme ? 0.88 : 0.5,
      blending: isDarkTheme ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: false
    });

    stardustParticles = new THREE.Points(geometry, material);
    scene.add(stardustParticles);
  }

  /**
   * 3. Floating 3D Geometric Sculptures (Wireframe Icosahedron, Torus Knot, Gyroscopic Rings)
   */
  function buildFloatingGeometries() {
    geomGroup = new THREE.Group();

    // A. Holographic Wireframe Icosahedron (Right side)
    const icoGeom = new THREE.IcosahedronGeometry(100, 1);
    const icoWireGeom = new THREE.WireframeGeometry(icoGeom);
    const icoMaterial = new THREE.LineBasicMaterial({
      color: isDarkTheme ? 0x818cf8 : 0x6366f1,
      transparent: true,
      opacity: isDarkTheme ? 0.85 : 0.45,
      linewidth: 2
    });
    icosahedronMesh = new THREE.LineSegments(icoWireGeom, icoMaterial);
    icosahedronMesh.position.set(380, 80, -80);
    geomGroup.add(icosahedronMesh);

    // Glowing Vertex points for the Icosahedron
    const icoPointsMat = new THREE.PointsMaterial({
      color: 0x06b6d4,
      size: isDarkTheme ? 9 : 6,
      map: createParticleGlowTexture('#06b6d4'),
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending
    });
    icosahedronPoints = new THREE.Points(icoGeom, icoPointsMat);
    icosahedronPoints.position.copy(icosahedronMesh.position);
    geomGroup.add(icosahedronPoints);

    // B. Twisting 3D Torus Knot (Left side)
    const knotGeom = new THREE.TorusKnotGeometry(72, 16, 90, 16);
    const knotWireGeom = new THREE.WireframeGeometry(knotGeom);
    const knotMaterial = new THREE.LineBasicMaterial({
      color: isDarkTheme ? 0xd946ef : 0xa855f7,
      transparent: true,
      opacity: isDarkTheme ? 0.8 : 0.38
    });
    torusKnotMesh = new THREE.LineSegments(knotWireGeom, knotMaterial);
    torusKnotMesh.position.set(-390, -40, -120);
    geomGroup.add(torusKnotMesh);

    // C. Gyroscopic Orbital Rings (Center-top depth)
    const ringMat = new THREE.LineBasicMaterial({
      color: isDarkTheme ? 0x38bdf8 : 0x0284c7,
      transparent: true,
      opacity: isDarkTheme ? 0.65 : 0.32
    });
    gyroRing1 = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(130, 1.5, 12, 60)), ringMat);
    gyroRing2 = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(110, 1.5, 12, 60)), ringMat);
    gyroRing3 = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.TorusGeometry(90, 1.5, 12, 60)), ringMat);

    gyroRing1.position.set(20, 140, -220);
    gyroRing2.position.copy(gyroRing1.position);
    gyroRing3.position.copy(gyroRing1.position);

    geomGroup.add(gyroRing1);
    geomGroup.add(gyroRing2);
    geomGroup.add(gyroRing3);

    // D. Floating Octahedron (Subtle foreground satellite)
    const octGeom = new THREE.OctahedronGeometry(45, 0);
    const octWire = new THREE.WireframeGeometry(octGeom);
    const octMat = new THREE.LineBasicMaterial({
      color: isDarkTheme ? 0x34d399 : 0x059669,
      transparent: true,
      opacity: isDarkTheme ? 0.7 : 0.3
    });
    octahedronMesh = new THREE.LineSegments(octWire, octMat);
    octahedronMesh.position.set(-200, 180, -60);
    geomGroup.add(octahedronMesh);

    scene.add(geomGroup);
  }

  /**
   * Adapt visual colors smoothly when switching Dark/Light Theme
   */
  function applyThemeColors() {
    if (!scene) return;

    const dark = isDarkTheme;
    const fogColor = dark ? 0x080c18 : 0xf1f5f9;
    scene.fog.color.setHex(fogColor);

    if (ambientLight) ambientLight.color.setHex(dark ? 0x312e81 : 0x818cf8);
    if (pointLight1) pointLight1.intensity = dark ? 2.5 : 1.4;
    if (pointLight2) pointLight2.intensity = dark ? 2.2 : 1.2;

    if (waveParticles) {
      waveParticles.material.color.setHex(dark ? 0x6366f1 : 0x4f46e5);
      waveParticles.material.opacity = dark ? 0.9 : 0.45;
      waveParticles.material.size = dark ? 13 : 9;
      waveParticles.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
      waveParticles.material.needsUpdate = true;
    }

    if (stardustParticles) {
      stardustParticles.material.opacity = dark ? 0.88 : 0.5;
      stardustParticles.material.size = dark ? 9 : 6.5;
      stardustParticles.material.blending = dark ? THREE.AdditiveBlending : THREE.NormalBlending;
      stardustParticles.material.needsUpdate = true;
    }

    if (icosahedronMesh) {
      icosahedronMesh.material.color.setHex(dark ? 0x818cf8 : 0x6366f1);
      icosahedronMesh.material.opacity = dark ? 0.85 : 0.45;
    }

    if (torusKnotMesh) {
      torusKnotMesh.material.color.setHex(dark ? 0xd946ef : 0xa855f7);
      torusKnotMesh.material.opacity = dark ? 0.8 : 0.38;
    }

    if (gyroRing1 && gyroRing2 && gyroRing3) {
      const ringCol = dark ? 0x38bdf8 : 0x0284c7;
      const ringOp = dark ? 0.65 : 0.32;
      [gyroRing1, gyroRing2, gyroRing3].forEach(ring => {
        ring.material.color.setHex(ringCol);
        ring.material.opacity = ringOp;
      });
    }

    if (octahedronMesh) {
      octahedronMesh.material.color.setHex(dark ? 0x34d399 : 0x059669);
      octahedronMesh.material.opacity = dark ? 0.7 : 0.3;
    }
  }

  /**
   * Event: Mouse tracking with normalization
   */
  function onMouseMove(event) {
    mouse.targetX = (event.clientX - windowHalfX) * 0.4;
    mouse.targetY = (event.clientY - windowHalfY) * 0.35;
  }

  /**
   * Event: Click triggers interactive 3D shockwave impulse
   */
  function onPointerDown() {
    shockwave.active = true;
    shockwave.radius = 10;
    shockwave.intensity = 60;
  }

  /**
   * Event: Window Resize
   */
  function onWindowResize() {
    windowHalfX = window.innerWidth / 2;
    windowHalfY = window.innerHeight / 2;

    if (camera && renderer) {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    }
  }

  /**
   * Event: Visibility Change (Conserve Battery & CPU)
   */
  function onVisibilityChange() {
    if (document.hidden) {
      isRunning = false;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    } else {
      isRunning = true;
      if (clock) clock.getDelta(); // reset delta so no physics jumps
      animate();
    }
  }

  /**
   * Main 3D Animation & Physics Render Loop
   */
  function animate() {
    if (!isRunning) return;
    animationFrameId = requestAnimationFrame(animate);

    const delta = clock ? clock.getDelta() : 0.016;
    const elapsedTime = clock ? clock.getElapsedTime() : Date.now() * 0.001;

    // 1. Smooth Camera Lerp for Parallax
    mouse.x += (mouse.targetX - mouse.x) * 0.045;
    mouse.y += (mouse.targetY - mouse.y) * 0.045;

    camera.position.x = mouse.x * 0.85;
    camera.position.y = 60 - mouse.y * 0.7;
    camera.lookAt(0, 0, -100);

    // 2. Animate Wave Particle Mesh
    if (waveGeometry && waveParticles) {
      const positions = waveGeometry.attributes.position.array;
      const original = waveGeometry.userData.originalPositions;

      // Advance Shockwave
      if (shockwave.active) {
        shockwave.radius += shockwave.speed;
        shockwave.intensity *= 0.95;
        if (shockwave.radius > shockwave.maxRadius || shockwave.intensity < 0.5) {
          shockwave.active = false;
        }
      }

      let pIdx = 0;
      for (let iz = 0; iz < GRID_SEGS_Z; iz++) {
        for (let ix = 0; ix < GRID_SEGS_X; ix++) {
          const origX = original[pIdx * 3];
          const origY = original[pIdx * 3 + 1];
          const origZ = original[pIdx * 3 + 2];

          // Complex layered sine + cosine wave equation
          const waveHeight = 
            Math.sin(origX * 0.009 + elapsedTime * 1.5) * 28 +
            Math.cos(origZ * 0.011 + elapsedTime * 1.2) * 22 +
            Math.sin((origX + origZ) * 0.005 + elapsedTime * 2.0) * 14;

          // Shockwave ripple offset
          let rippleOffset = 0;
          if (shockwave.active) {
            const dist = Math.sqrt(origX * origX + origZ * origZ);
            const diff = Math.abs(dist - shockwave.radius);
            if (diff < 75) {
              rippleOffset = Math.sin((1 - diff / 75) * Math.PI) * shockwave.intensity;
            }
          }

          positions[pIdx * 3 + 1] = origY + waveHeight + rippleOffset;
          pIdx++;
        }
      }
      waveGeometry.attributes.position.needsUpdate = true;
    }

    // 3. Animate Ambient Stardust Rotation & Drift
    if (stardustParticles) {
      stardustParticles.rotation.y = elapsedTime * 0.025;
      stardustParticles.rotation.x = Math.sin(elapsedTime * 0.015) * 0.05;
    }

    // 4. Animate Floating 3D Geometries
    if (icosahedronMesh) {
      icosahedronMesh.rotation.x += 0.004;
      icosahedronMesh.rotation.y += 0.006;
      icosahedronMesh.position.y = 90 + Math.sin(elapsedTime * 1.2) * 16;
      if (icosahedronPoints) {
        icosahedronPoints.rotation.copy(icosahedronMesh.rotation);
        icosahedronPoints.position.copy(icosahedronMesh.position);
      }
    }

    if (torusKnotMesh) {
      torusKnotMesh.rotation.x += 0.005;
      torusKnotMesh.rotation.z += 0.004;
      torusKnotMesh.position.y = -40 + Math.cos(elapsedTime * 1.1) * 14;
    }

    if (gyroRing1 && gyroRing2 && gyroRing3) {
      gyroRing1.rotation.x += 0.009;
      gyroRing1.rotation.y += 0.005;

      gyroRing2.rotation.y += 0.011;
      gyroRing2.rotation.z += 0.007;

      gyroRing3.rotation.x += 0.006;
      gyroRing3.rotation.z += 0.013;
    }

    if (octahedronMesh) {
      octahedronMesh.rotation.x -= 0.008;
      octahedronMesh.rotation.y += 0.007;
      octahedronMesh.position.y = 180 + Math.sin(elapsedTime * 1.4) * 12;
    }

    // 5. Render Scene
    renderer.render(scene, camera);
  }

  /**
   * Fallback 2.5D Canvas Engine (In case WebGL or Three.js CDN is unavailable)
   */
  function initFallback2DCanvas(canvas) {
    const ctx = canvas.getContext('2d');
    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    window.addEventListener('resize', () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    });

    const numPoints = 85;
    const points = [];
    for (let i = 0; i < numPoints; i++) {
      points.push({
        x: Math.random() * width,
        y: Math.random() * height,
        z: Math.random() * 800 + 200,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8
      });
    }

    function render2D() {
      ctx.clearRect(0, 0, width, height);
      const isDark = checkIsDarkTheme();
      const dotColor = isDark ? 'rgba(99, 102, 241, ' : 'rgba(79, 70, 229, ';
      const lineColor = isDark ? 'rgba(6, 182, 212, ' : 'rgba(99, 102, 241, ';

      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        p.x += p.vx;
        p.y += p.vy;

        if (p.x < 0) p.x = width;
        if (p.x > width) p.x = 0;
        if (p.y < 0) p.y = height;
        if (p.y > height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, isDark ? 2.5 : 2, 0, Math.PI * 2);
        ctx.fillStyle = dotColor + (isDark ? '0.7)' : '0.4)');
        ctx.fill();

        for (let j = i + 1; j < points.length; j++) {
          const p2 = points[j];
          const dist = Math.hypot(p.x - p2.x, p.y - p2.y);
          if (dist < 130) {
            const alpha = (1 - dist / 130) * (isDark ? 0.28 : 0.15);
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = lineColor + alpha + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
      requestAnimationFrame(render2D);
    }
    render2D();
  }

  // Auto-boot when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init3DBackground);
  } else {
    init3DBackground();
  }

  // Expose API on window for external control
  window.Portal3DBackground = {
    triggerPulse: onPointerDown,
    refreshTheme: applyThemeColors
  };

})();
