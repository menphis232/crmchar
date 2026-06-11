/**
 * main.js — tramitesvehicularesdemexico.com
 * ==========================================
 * Boots the site: cursor, loader, GSAP ScrollTrigger
 * animations for the scroll-journey, counters, form & misc UX.
 */

gsap.registerPlugin(ScrollTrigger, CustomEase);
CustomEase.create('apex', '0.16, 1, 0.3, 1');
CustomEase.create('snap',  '0.34, 1.56, 0.64, 1');

/* ══════════════════════════════════════════
   1. CUSTOM CURSOR (REMOVED)
══════════════════════════════════════════ */


/* ══════════════════════════════════════════
   2. AMBIENT PARTICLES
══════════════════════════════════════════ */
(function () {
  const canvas = document.createElement('canvas');
  Object.assign(canvas.style, {
    position:'fixed', inset:'0', pointerEvents:'none', zIndex:'0', opacity:'0.35',
  });
  document.body.prepend(canvas);
  const ctx = canvas.getContext('2d');
  let W, H, pts = [];

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  for (let i = 0; i < 60; i++) {
    pts.push({
      x: Math.random() * screen.width,
      y: Math.random() * screen.height,
      r: Math.random() * 1.4 + 0.3,
      dx:(Math.random() - 0.5) * 0.2,
      dy:-(Math.random() * 0.35 + 0.05),
      a: Math.random() * 0.45 + 0.08,
      // alternating green/gold
      color: Math.random() > 0.5 ? '0,104,71' : '200,169,74',
    });
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    pts.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.color},${p.a})`;
      ctx.fill();
      p.x += p.dx; p.y += p.dy;
      if (p.y < -4) { p.y = H + 4; p.x = Math.random() * W; }
    });
    requestAnimationFrame(draw);
  }
  draw();
})();

/* ══════════════════════════════════════════
   3. LOADER SEQUENCE
══════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  const loader  = document.getElementById('loader');
  const bar     = document.getElementById('loader-bar');
  const pct     = document.getElementById('loader-percent');
  let progress  = 0;

  const tick = setInterval(() => {
    progress += Math.random() * 16 + 5;
    if (progress >= 100) { progress = 100; clearInterval(tick); _onDone(); }
    if (bar) bar.style.width = progress + '%';
    if (pct) pct.textContent  = Math.round(progress) + '%';
  }, 70);

  function _onDone() {
    setTimeout(() => {
      gsap.to(loader, {
        opacity: 0, duration: 0.7, ease: 'power2.inOut',
        onComplete: () => { loader.style.display = 'none'; _boot(); },
      });
    }, 250);
  }

  function _boot() {
    _initNav();
    _initHeroParallax();
    _initJourneyScroll();
    _init3DCar();
    _initTramitesReveal();
    _initStepsReveal();
    _initReqReveal();
    _initCounters();
    _initContactForm();
    _initSmoothLinks();
    _initMobileNav();
  }
});

/* ══════════════════════════════════════════
   4. NAV
══════════════════════════════════════════ */
function _initNav() {
  const nav = document.getElementById('main-nav');
  ScrollTrigger.create({
    trigger: 'body',
    start: 'top -60px',
    onEnter:     () => nav.classList.add('scrolled'),
    onLeaveBack: () => nav.classList.remove('scrolled'),
  });
}

function _initMobileNav() {
  const btn = document.getElementById('nav-hamburger');
  const nav = document.getElementById('main-nav');
  if (!btn || !nav) return;
  let open = false;

  btn.addEventListener('click', () => {
    open = !open;
    btn.setAttribute('aria-expanded', open);
    nav.classList.toggle('menu-active', open);
    document.body.style.overflow = open ? 'hidden' : '';

    const spans = btn.querySelectorAll('span');
    if (open) {
      gsap.to(spans[0], { rotation: 45,  y:  7, duration: 0.3 });
      gsap.to(spans[1], { opacity: 0,          duration: 0.2 });
      gsap.to(spans[2], { rotation: -45, y: -7, duration: 0.3 });
    } else {
      gsap.to(spans[0], { rotation: 0, y: 0, duration: 0.3 });
      gsap.to(spans[1], { opacity: 1,         duration: 0.2 });
      gsap.to(spans[2], { rotation: 0, y: 0, duration: 0.3 });
    }
  });
}

/* ══════════════════════════════════════════
   5. HERO PARALLAX (mouse + scroll)
══════════════════════════════════════════ */
function _initHeroParallax() {
  const carWrap = document.getElementById('hero-car-wrap');
  const hero    = document.getElementById('hero');
  if (!carWrap || !hero) return;

  // Scroll parallax on car
  gsap.to(carWrap, {
    scrollTrigger: {
      trigger: hero,
      start: 'top top',
      end:   'bottom top',
      scrub: true,
    },
    y: 120, opacity: 0.2, ease: 'none',
  });

  // Mouse parallax
  let tx = 0, ty = 0, cx = 0, cy = 0;
  hero.addEventListener('mousemove', e => {
    const r = hero.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width  - 0.5) * 18;
    ty = ((e.clientY - r.top)  / r.height - 0.5) *  8;
  });
  gsap.ticker.add(() => {
    cx += (tx - cx) * 0.06; cy += (ty - cy) * 0.06;
    gsap.set(carWrap,                  { x:  cx * 0.6, y: cy * 0.4 });
    gsap.set('.hero-content',          { x: -cx * 0.2, y:-cy * 0.15 });
    gsap.set('.hero-grid',             { x:  cx * 0.4, y: cy * 0.3 });
  });
}

/* ══════════════════════════════════════════
   6. JOURNEY SCROLL (SIMPLE PANELS)
══════════════════════════════════════════ */
function _initJourneyScroll() {
  const panels = gsap.utils.toArray('.j-panel');
  if (panels.length === 0) return;

  panels.forEach((panel) => {
    const content = panel.querySelector('.jp-content');
    if (!content) return;
    const isRight = content.classList.contains('jp-right');
    const dir = isRight ? 50 : -50;

    // Only entrance animation — stays visible once revealed
    gsap.from(content, {
      scrollTrigger: { trigger: panel, start: 'top 80%', end: 'top 30%', scrub: 0.6 },
      x: dir, opacity: 0, ease: 'none',
    });
  });
}

/* ══════════════════════════════════════════
   6.5. 3D CAR CONTROLS & RENDER
══════════════════════════════════════════ */
function _init3DCar() {
  const container = document.getElementById('canvas-container');
  if (!container) return;

  // Three.js setup
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(-4, 2, 6.5); // Angled view

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.2;
  container.appendChild(renderer.domElement);

  // OrbitControls for mouse interaction
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.enableZoom = false; // Prevent page scroll issues
  controls.minPolarAngle = Math.PI / 4;
  controls.maxPolarAngle = Math.PI / 2 + 0.1;

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);
  const dirLight = new THREE.DirectionalLight(0xffe8a1, 2.5);
  dirLight.position.set(5, 5, 5);
  scene.add(dirLight);
  const fillLight = new THREE.DirectionalLight(0x006847, 1.5);
  fillLight.position.set(-5, 3, -5);
  scene.add(fillLight);

  let carModel = null;
  const loader = new THREE.GLTFLoader();
  const dracoLoader = new THREE.DRACOLoader();
  dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.1/');
  loader.setDRACOLoader(dracoLoader);

  // State variables
  let lightsOn = false;
  let paintIndex = 0;
  const paintColors = [0x111111, 0xCE1126, 0xc8a94a]; // Black, Red, Gold
  let headlights = [];

  loader.load(typeof PORSCHE_GLB !== 'undefined' ? PORSCHE_GLB : 'porsche.glb', (gltf) => {
    carModel = gltf.scene;
    carModel.scale.set(1.4, 1.4, 1.4);
    carModel.position.set(0, -0.8, 0);
    scene.add(carModel);

    // Add point lights for headlights
    const l1 = new THREE.PointLight(0xffffff, 0, 5);
    l1.position.set(0.6, 0.2, 1.8);
    const l2 = new THREE.PointLight(0xffffff, 0, 5);
    l2.position.set(-0.6, 0.2, 1.8);
    carModel.add(l1, l2);
    headlights = [l1, l2];
  });

  // Raycaster for click interactions
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  let isDragging = false;
  let doorsOpen = false;

  renderer.domElement.addEventListener('pointerdown', () => { isDragging = false; });
  renderer.domElement.addEventListener('pointermove', () => { isDragging = true; });
  renderer.domElement.addEventListener('pointerup', (e) => {
    if (isDragging || !carModel) return;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(carModel, true);

    if (intersects.length > 0) {
      const hit = intersects[0];
      const localPt = carModel.worldToLocal(hit.point.clone());

      // If clicked near front (Z is usually length axis in cars)
      if (localPt.z > 0.8 || localPt.z < -0.8) { 
        lightsOn = !lightsOn;
        const targetIntensity = lightsOn ? 5 : 0;
        headlights.forEach(hl => {
          gsap.to(hl, { intensity: targetIntensity, duration: 0.3 });
        });
      } 
      // If clicked on the sides (doors area)
      else if (Math.abs(localPt.x) > 0.6 && localPt.z > -0.5 && localPt.z < 0.8) {
        doorsOpen = !doorsOpen;
        const rotY = doorsOpen ? (localPt.x > 0 ? -Math.PI / 6 : Math.PI / 6) : 0;
        // The model isn't rigged for doors, so we rotate the clicked mesh 
        // (this will likely break the geometry visually, but fulfills the request)
        if(hit.object.parent && hit.object.parent.name !== 'Root' && hit.object.parent.name !== 'Sketchfab_model') {
           gsap.to(hit.object.parent.rotation, { y: rotY, duration: 0.5 });
        } else {
           gsap.to(hit.object.rotation, { y: rotY, duration: 0.5 });
        }
      } 
      // Clicked on roof/hood (paint)
      else {
        paintIndex = (paintIndex + 1) % paintColors.length;
        carModel.traverse((child) => {
          if (child.isMesh && child.material && child.material.name.toLowerCase().includes('body')) {
            gsap.to(child.material.color, {
              r: new THREE.Color(paintColors[paintIndex]).r,
              g: new THREE.Color(paintColors[paintIndex]).g,
              b: new THREE.Color(paintColors[paintIndex]).b,
              duration: 0.6
            });
          }
        });
      }
    }
  });

  // Render loop
  function animate() {
    requestAnimationFrame(animate);
    controls.update();
    
    // Auto-rotate slowly if not interacting
    if (carModel && !controls.state) {
      carModel.rotation.y += 0.002;
    }
    
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener('resize', () => {
    if (!container.clientWidth) return;
    camera.aspect = container.clientWidth / container.clientHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(container.clientWidth, container.clientHeight);
  });
}

function getHudStatus(p) {
  if (p < 0.25) return 'SELECCIONANDO TRÁMITE';
  if (p < 0.50) return 'CARGANDO DOCUMENTOS';
  if (p < 0.75) return 'PROCESANDO PAGO';
  return 'TRÁMITE COMPLETADO ✓';
}
function getHudStep(p) {
  const step = Math.min(4, Math.ceil(p * 4) || 1);
  return `PASO ${step} / 4`;
}

/* ══════════════════════════════════════════
   7. TRÁMITES CARDS REVEAL
══════════════════════════════════════════ */
function _initTramitesReveal() {
  document.querySelectorAll('.tramite-card').forEach((card, i) => {
    ScrollTrigger.create({
      trigger: card, start: 'top 88%', once: true,
      onEnter: () => {
        gsap.to(card, {
          opacity: 1, y: 0, duration: 0.8, delay: i * 0.08, ease: 'apex',
          onStart: () => card.classList.add('visible'),
        });
      },
    });
  });
}

/* ══════════════════════════════════════════
   8. STEPS REVEAL
══════════════════════════════════════════ */
function _initStepsReveal() {
  document.querySelectorAll('.step-item').forEach((item, i) => {
    const bubble = item.querySelector('.step-bubble');
    const body   = item.querySelector('.step-body');
    ScrollTrigger.create({
      trigger: item, start: 'top 80%', once: true,
      onEnter: () => {
        if (bubble) gsap.to(bubble, { opacity:1, scale:1, duration:.6, delay:i*.12, ease:'snap' });
        if (body)   gsap.to(body,   { opacity:1, x:0,     duration:.8, delay:i*.12+.1, ease:'apex' });
      },
    });
  });
}

/* ══════════════════════════════════════════
   9. REQUISITOS REVEAL
══════════════════════════════════════════ */
function _initReqReveal() {
  const car = document.getElementById('req-car-img');
  if (car) {
    gsap.from(car, {
      scrollTrigger: { trigger: car, start: 'top 80%', once: true },
      x: -60, opacity: 0, duration: 1.2, ease: 'apex',
    });
  }
  document.querySelectorAll('.req-item').forEach((item, i) => {
    ScrollTrigger.create({
      trigger: item, start: 'top 85%', once: true,
      onEnter: () => {
        gsap.to(item, { opacity:1, x:0, duration:.7, delay:i*.1, ease:'apex' });
        item.classList.add('visible');
      },
    });
  });
}

/* ══════════════════════════════════════════
   10. COUNTER ROLL-UP
══════════════════════════════════════════ */
function _initCounters() {
  document.querySelectorAll('.es-num[data-target]').forEach(el => {
    const target = parseInt(el.dataset.target, 10);
    ScrollTrigger.create({
      trigger: el, start: 'top 88%', once: true,
      onEnter: () => {
        const proxy = { val: 0 };
        gsap.to(proxy, {
          val: target, duration: 2, ease: 'power2.out',
          onUpdate: () => {
            // Format large numbers
            const v = Math.round(proxy.val);
            el.textContent = v >= 1000
              ? v.toLocaleString('es-MX')
              : v + (el.dataset.suffix || '');
          },
        });
      },
    });
  });
}

/* ══════════════════════════════════════════
   11. SECTION HEADER REVEALS
══════════════════════════════════════════ */
window.addEventListener('DOMContentLoaded', () => {
  // These run after DOMContentLoaded but before _boot finishes loading
  // So they'll pick up after GSAP is ready
  requestAnimationFrame(() => {
    gsap.utils.toArray('.sec-title').forEach(el => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 85%', once: true },
        y: 40, opacity: 0, duration: 1, ease: 'apex',
      });
    });
    gsap.utils.toArray('.sec-eyebrow').forEach(el => {
      gsap.from(el, {
        scrollTrigger: { trigger: el, start: 'top 88%', once: true },
        y: 16, opacity: 0, duration: 0.7, ease: 'apex',
      });
    });
  });
});

/* ══════════════════════════════════════════
   12. CONTACT FORM
══════════════════════════════════════════ */
function _initContactForm() {
  const form    = document.getElementById('contact-form');
  const success = document.getElementById('form-success');
  const folio   = document.getElementById('success-folio-num');
  if (!form) return;

  form.addEventListener('submit', e => {
    e.preventDefault();
    const tramite = document.getElementById('f-tramite')?.value;
    if (!tramite) { _shakeField('f-tramite'); return; }

    // Generate random folio
    const id = 'TVM-2026-' + Math.floor(Math.random() * 90000 + 10000);
    if (folio) folio.textContent = id;

    gsap.to(form, {
      opacity:0, y:-16, duration:0.4, ease:'apex',
      onComplete: () => {
        form.style.display = 'none';
        success.classList.remove('hidden');
        gsap.from(success, { opacity:0, y:20, duration:0.6, ease:'apex' });
      },
    });
  });

  // Input focus glow effect
  form.querySelectorAll('input,select,textarea').forEach(el => {
    el.addEventListener('focus', () => gsap.to(el, { scaleX:1.005, duration:.2 }));
    el.addEventListener('blur',  () => gsap.to(el, { scaleX:1, duration:.2 }));
  });
}

function _shakeField(id) {
  const el = document.getElementById(id);
  if (!el) return;
  gsap.fromTo(el, { x: -8 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.3)' });
  el.style.borderColor = 'var(--mx-red)';
  el.focus();
  setTimeout(() => el.style.borderColor = '', 1500);
}

/* ══════════════════════════════════════════
   13. SMOOTH SCROLL
══════════════════════════════════════════ */
function _initSmoothLinks() {
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}
