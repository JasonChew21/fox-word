(function () {
  'use strict';

  const motion = globalThis.InkFoxMotion;
  const params = new URLSearchParams(window.location.search);
  const variant = params.get('fox') ?? 'painted';
  const inkStudy = variant === 'ink';
  const paintingStudy = variant === 'painted';
  const art = paintingStudy ? globalThis.InkPaintedFox
    : inkStudy ? globalThis.InkBrushFox : globalThis.InkFoxArt;
  if (inkStudy) document.title = '墨间有狐 · 笔墨试验';
  if (paintingStudy) document.title = '墨间有狐 · 插画试验';
  const W = 1600;
  const H = 900;
  const TAU = Math.PI * 2;
  const paper = '244,242,238';
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const mix = (a, b, t) => a + (b - a) * t;
  const wrap = (value, length) => ((value % length) + length) % length;
  const canvas = document.getElementById('scene');
  const pause = document.getElementById('pause');
  const restart = document.getElementById('restart');
  const message = document.getElementById('message');
  canvas.dataset.ready = 'false';
  const ctx = canvas.getContext('2d', { alpha: false });
  const prefersStill = window.matchMedia('(prefers-reduced-motion: reduce)');
  const plate = new Image();
  const bank = [
    [255, 908], [395, 881], [530, 867], [680, 850], [840, 837],
    [1010, 824], [1180, 797], [1337, 760], [1470, 734]
  ];
  const lake = new Path2D('M43 464C245 442 449 461 628 440C866 423 1170 418 1500 461L1568 596C1467 662 1378 701 1237 739C1098 766 987 774 801 784C619 793 472 795 342 793L187 777Z');
  const reedRandom = motion.randomFrom(5472);
  const clusters = [
    [203, 920, 5, 102, -14], [267, 903, 5, 77, 26],
    [343, 904, 4, 31, -3], [1290, 872, 4, 55, -17],
    [1458, 858, 6, 138, -33], [1567, 856, 4, 111, -17]
  ];
  const reeds = clusters.flatMap(([x, y, count, height, lean]) => Array.from({ length: count }, () => ({
    x: x + (reedRandom() - .5) * 51, y: y + (reedRandom() - .5) * 10,
    height: height * (.54 + reedRandom() * .59),
    lean: lean + (reedRandom() - .5) * 35, ink: .24 + reedRandom() * .43, phase: reedRandom() * TAU
  }))).sort((a, b) => a.y - b.y);
  const fog = ctx ? [makeMist(48), makeMist(183), makeMist(561)] : [];

  let world;
  let waterRandom;
  let glints = [];
  let rings = [];
  let nextRing = 0;
  let paused = prefersStill.matches;
  let ready = false;
  let raf = null;
  let lastTime;
  let cameraX = 0;
  let scale = 1;
  let top = 0;
  let vw = W;
  let vh = H;
  let dpr = 1;
  let actorScale = motion.FOX_SCALE;

  function groundAt(x) {
    let i = 0;
    while (i < bank.length - 2 && x > bank[i + 1][0]) i++;
    const [fromX, fromY] = bank[i];
    const [toX, toY] = bank[i + 1];
    return mix(fromY, toY, (x - fromX) / (toX - fromX));
  }

  function makeMist(seed) {
    const tex = document.createElement('canvas');
    tex.width = 456;
    tex.height = 144;
    const b = tex.getContext('2d');
    const random = motion.randomFrom(seed);
    for (let i = 0; i < 21; i++) {
      const x = 74 + random() * 308;
      const y = 45 + random() * 52;
      const radius = 34 + random() * 43;
      const alpha = .035 + random() * .09;
      const brush = b.createRadialGradient(x, y, 0, x, y, radius);
      brush.addColorStop(0, 'rgba(' + paper + ',' + alpha + ')');
      brush.addColorStop(.42, 'rgba(' + paper + ',' + alpha * .55 + ')');
      brush.addColorStop(1, 'rgba(' + paper + ',0)');
      b.fillStyle = brush;
      b.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    b.globalCompositeOperation = 'destination-in';
    const taper = b.createLinearGradient(0, 0, 456, 0);
    taper.addColorStop(0, 'transparent');
    taper.addColorStop(.18, 'black');
    taper.addColorStop(.79, 'black');
    taper.addColorStop(1, 'transparent');
    b.fillStyle = taper;
    b.fillRect(0, 0, 456, 144);
    return tex;
  }

  function seedScene(seed) {
    world = motion.createWorld(seed, { planted: paintingStudy });
    waterRandom = motion.randomFrom(world.seed ^ 0x52639a);
    rings = [];
    nextRing = 1.2 + waterRandom() * 4;
    glints = Array.from({ length: 62 }, () => {
      const depth = waterRandom();
      return {
        x: 73 + waterRandom() * 1465, y: 454 + depth * 338,
        width: (8 + depth * 50) * (.42 + waterRandom()),
        phase: waterRandom() * TAU, speed: .26 + waterRandom() * .62,
        brightness: .06 + waterRandom() * .22
      };
    });
    lastTime = undefined;
    trackCamera(0);
  }

  function frameSeed() {
    const raw = params.get('seed');
    return raw !== null && /^\d{1,10}$/.test(raw) ? Number(raw) >>> 0 : undefined;
  }

  function trackCamera(delta) {
    if (!world) return;
    const fox = world.fox;
    const focus = fox.x - fox.facing * 42 * actorScale + fox.facing * fox.speed * .13;
    const goal = clamp(focus - vw / 2, 0, Math.max(0, W - vw));
    cameraX = delta > 0 ? mix(cameraX, goal, 1 - Math.exp(-delta * 2.45)) : goal;
  }

  function size() {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    dpr = Math.min(window.devicePixelRatio || 1, Math.sqrt(3200000 / (width * height)), 1.8);
    const pw = Math.round(width * dpr);
    const ph = Math.round(height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    scale = Math.max(width / W, height / H);
    vw = width / scale;
    vh = height / scale;
    top = (H - vh) * .88;
    actorScale = Math.min(motion.FOX_SCALE, vw / 324);
    trackCamera(0);
    if (ready) render();
  }

  function renderMist() {
    const { weather, time } = world;
    const density = .26 + weather.mist * .69;
    ctx.save();
    const drift = weather.drift;
    const passes = [
      [0, 122, 258, 1070, 169, .48, .51],
      [2, 522, 257, 1221, 151, .59, .43],
      [1, -230, 351, 1200, 149, .58, .85],
      [0, 687, 358, 1060, 121, .51, .97],
      [2, -80, 407, 653, 96, .29, 1.44]
    ];
    for (const [texture, anchor, y, width, height, strength, speed] of passes) {
      const x = wrap(anchor + drift * speed + width + 80, W + width + 140) - width - 80;
      ctx.globalAlpha = density * strength * (.86 + .10 * Math.sin(time * .12 + texture));
      ctx.drawImage(fog[texture], x, y + Math.sin(time * .09 + texture) * 9, width, height);
    }
    ctx.restore();
  }

  function stepRiver() {
    if (world.time >= nextRing) {
      const x = 375 + waterRandom() * 798;
      const y = 575 + waterRandom() * 151;
      rings.push({ x, y, at: world.time, longevity: 3.3 + waterRandom() * 3 });
      nextRing = world.time + 5.6 + waterRandom() * 9.3;
    }
    while (rings.length && world.time - rings[0].at >= rings[0].longevity) rings.shift();
  }

  function renderRiver() {
    const { time, weather } = world;
    ctx.save();
    ctx.clip(lake);
    ctx.lineCap = 'round';
    const source = plate.naturalHeight / H;
    ctx.globalAlpha = .43 + weather.gust * .10;
    for (let y = 445; y < 805; y += 13) {
      const depth = (y - 425) / 380;
      const swell = Math.sin(y * .061 + time * .57) + .58 * Math.sin(y * .11 - time * .26);
      const dx = swell * (.74 + Math.abs(weather.wind) * 1.9 + depth * 2.1);
      ctx.drawImage(plate, 0, y * source, plate.naturalWidth, 13 * source, dx - 4, y, W + 8, 13);
    }
    for (const g of glints) {
      const breath = (.5 + .5 * Math.sin(time * g.speed + g.phase)) ** 2;
      const x = wrap(g.x + weather.drift * .51, W + 150) - 70;
      const y = g.y + Math.sin(time * .34 + g.phase) * 1.2;
      ctx.globalAlpha = g.brightness * breath;
      ctx.strokeStyle = g.phase > 4.8 ? '#8c8985' : '#fbf9f7';
      ctx.lineWidth = mix(.58, 1.45, (y - 447) / 360);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x + g.width * .43, y - .97, x + g.width, y + .32);
      ctx.stroke();
    }
    for (const ring of rings) {
      const u = (time - ring.at) / ring.longevity;
      for (let i = 0; i < 3; i++) {
        const local = u - i * .11;
        if (local <= 0 || local >= 1) continue;
        const radius = 3 + local * 62;
        ctx.globalAlpha = .25 * Math.sin(Math.PI * local) * (1 - i * .16);
        ctx.lineWidth = .9;
        ctx.strokeStyle = i === 1 ? '#a09a94' : '#fffdf9';
        ctx.beginPath();
        ctx.ellipse(ring.x, ring.y + u * 1.8, radius, radius * .116, 0, .18, 2.82);
        ctx.moveTo(ring.x - radius * .83, ring.y - radius * .061 + u * 1.8);
        ctx.ellipse(ring.x, ring.y + u * 1.8, radius, radius * .116, 0, 3.71, 6.15);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  function reedPath(x, y, h, bend, t) {
    return [x + bend * t * t, y - h * t];
  }

  function renderReeds() {
    const { time, weather } = world;
    ctx.save();
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    for (const reed of reeds) {
      const { x, y, height: h, phase } = reed;
      const air = weather.wind * .64 + Math.sin(time * (0.86 + phase * .06) + phase) * (.21 + weather.gust * .19);
      const bend = reed.lean + air * h * .41;
      const [tx, ty] = reedPath(x, y, h, bend, 1);
      ctx.strokeStyle = '#3e3d3a';
      ctx.lineWidth = Math.max(.59, h / 75);
      ctx.globalAlpha = reed.ink;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.quadraticCurveTo(x, y - h * .51, tx, ty);
      ctx.stroke();
      for (let i = 0; i < 3; i++) {
        const along = .20 + i * .205;
        const direction = (i + Math.floor(phase)) % 2 ? 1 : -1;
        const [bx, by] = reedPath(x, y, h, bend, along);
        const reach = h * (.27 + .05 * Math.sin(phase + i));
        const lx = bx + direction * reach + air * h * .15;
        const ly = by - h * (.21 - i * .019);
        ctx.globalAlpha = reed.ink * (.60 + i * .15);
        ctx.fillStyle = i === 2 ? '#595653' : '#494844';
        ctx.beginPath();
        ctx.moveTo(bx, by);
        ctx.quadraticCurveTo(bx + direction * reach * .36, by - reach * .87, lx, ly);
        ctx.quadraticCurveTo(bx + direction * reach * .39, by - reach * .62, bx + direction * 1.1, by + 1.5);
        ctx.fill();
      }
      if (h > 52) {
        ctx.globalAlpha = reed.ink * .83;
        ctx.lineWidth = .75;
        const direction = bend < 0 ? -1 : 1;
        const inflorescence = h * .205;
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.quadraticCurveTo(tx + inflorescence * .45 * direction, ty - inflorescence * .6,
          tx + inflorescence * direction, ty + inflorescence * .17);
        ctx.stroke();
        for (let i = 1; i <= 7; i++) {
          const u = i / 7;
          const lx = tx + direction * inflorescence * u;
          const ly = ty + inflorescence * (u * u * .82 - u * .65);
          ctx.beginPath();
          ctx.moveTo(lx, ly);
          ctx.quadraticCurveTo(lx + direction * (7 - u * 3), ly - 1.5, lx + direction * (9 - u * 4.5), ly + 3 + u * 3);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function render() {
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, -cameraX * dpr * scale, -top * dpr * scale);
    ctx.drawImage(plate, 0, 0, W, H);
    renderRiver();
    renderMist();
    const light = world.weather.light - .51;
    if (Math.abs(light) > .012) {
      ctx.fillStyle = light > 0 ? 'rgba(255,255,255,' + light * .29 + ')' : 'rgba(52,52,52,' + -light * .21 + ')';
      ctx.fillRect(0, 0, W, H);
    }
    art.render(ctx, world, groundAt, actorScale);
    renderReeds();
  }

  function loop(now) {
    raf = null;
    if (!ready || paused || document.hidden) return;
    const delta = lastTime === undefined ? 0 : clamp((now - lastTime) / 1000, 0, .05);
    lastTime = now;
    motion.advance(world, delta);
    trackCamera(delta);
    stepRiver();
    render();
    raf = window.requestAnimationFrame(loop);
  }

  function start() {
    if (ready && !paused && !document.hidden && raf === null) {
      lastTime = undefined;
      raf = window.requestAnimationFrame(loop);
    }
  }

  function stop() {
    if (raf !== null) window.cancelAnimationFrame(raf);
    raf = null;
    lastTime = undefined;
  }

  function syncPause() {
    pause.setAttribute('aria-pressed', String(paused));
    pause.setAttribute('aria-label', paused ? '继续' : '暂停');
    pause.title = paused ? '继续（空格）' : '暂停（空格）';
    if (paused) stop();
    else start();
  }

  function foxAt(event) {
    if (!world || !ready) return null;
    const box = canvas.getBoundingClientRect();
    const x = (event.clientX - box.left) / scale + cameraX;
    const y = (event.clientY - box.top) / scale + top;
    const fx = (x - world.fox.x) * world.fox.facing / actorScale;
    const fy = (y - groundAt(world.fox.x)) / actorScale;
    if (paintingStudy) return fx > -159 && fx < 119 && fy > -147 && fy < 15 ? x : null;
    const back = inkStudy ? -180 : -163;
    const front = inkStudy ? 104 : 89;
    return fx > back && fx < front && fy > -143 && fy < 9 ? x : null;
  }

  pause.addEventListener('click', () => { paused = !paused; syncPause(); });
  restart.addEventListener('click', () => {
    if (!ready) return;
    seedScene();
    render();
    start();
  });
  canvas.addEventListener('pointermove', event => { canvas.style.cursor = foxAt(event) !== null ? 'pointer' : 'default'; });
  canvas.addEventListener('click', event => {
    const x = foxAt(event);
    if (!paused && x !== null) motion.attend(world, x);
  });
  document.addEventListener('keydown', event => {
    if (event.code !== 'Space' || event.repeat || (event.target instanceof HTMLElement && event.target.closest('button'))) return;
    event.preventDefault();
    paused = !paused;
    syncPause();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else start(); });
  prefersStill.addEventListener('change', event => { paused = event.matches; syncPause(); });
  window.addEventListener('resize', size);

  if (!ctx) {
    message.hidden = false;
    message.textContent = '浏览器无法绘制动画，江岸画面可以静看。';
    pause.disabled = restart.disabled = true;
    return;
  }

  plate.addEventListener('load', async () => {
    if (paintingStudy) {
      try {
        const animated = await art.prepare();
        canvas.setAttribute('aria-label', animated
          ? '江岸上的水墨狐狸。点一下狐狸，它会侧耳、抬头和提爪。'
          : '江岸上的水墨狐狸插画。当前浏览器仅显示狐狸的定姿。');
      } catch {
        message.textContent = '狐狸插画没有加载，请将网页和 assets 文件夹放在一起后再打开。';
        message.hidden = false;
        pause.disabled = restart.disabled = true;
        return;
      }
    }
    seedScene(frameSeed());
    size();
    ready = true;
    render();
    canvas.dataset.ready = 'true';
    syncPause();
  });
  plate.addEventListener('error', () => {
    message.hidden = false;
    message.textContent = '江岸底图没有加载，请将网页和 assets 文件夹放在一起后再打开。';
    pause.disabled = restart.disabled = true;
  });
  plate.src = 'assets/river.webp';
})();
