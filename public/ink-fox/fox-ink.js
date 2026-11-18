(function () {
  'use strict';

  const { footCycle, FOX_SCALE } = globalThis.InkFoxMotion;
  const PI = Math.PI;
  const RESOLUTION = 2;
  const TAIL_LENGTH = 144;
  const TAIL_HALF_WIDTH = 36;
  const INK = [24, 22, 21];
  const mix = (a, b, t) => a + (b - a) * t;
  const clamp = t => Math.max(0, Math.min(1, t));
  const ease = t => t * t * (3 - 2 * t);
  const smooth = (a, b, x) => ease(clamp((x - a) / (b - a)));
  let brushes;

  function grain(x, y, seed) {
    let n = Math.imul(x + seed, 374761393) + Math.imul(y - seed, 668265263);
    n = Math.imul(n ^ (n >>> 13), 1274126177);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
  }

  function noise(x, y, seed) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const tx = ease(x - ix);
    const ty = ease(y - iy);
    return mix(mix(grain(ix, iy, seed), grain(ix + 1, iy, seed), tx),
      mix(grain(ix, iy + 1, seed), grain(ix + 1, iy + 1, seed), tx), ty);
  }

  function surface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  // Approximate the distance to the nearest region of the mask in two passes.
  // A local fiber can then move the wet edge in either direction.
  function distances(mask, width, height, toInk) {
    const field = new Float32Array(width * height);
    for (let i = 0; i < field.length; i++) {
      field[i] = (mask[i * 4 + 3] >= 128) === toInk ? 0 : 1e6;
    }
    const diagonal = Math.SQRT2;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x;
        if (x > 0) field[i] = Math.min(field[i], field[i - 1] + 1);
        if (y === 0) continue;
        field[i] = Math.min(field[i], field[i - width] + 1);
        if (x > 0) field[i] = Math.min(field[i], field[i - width - 1] + diagonal);
        if (x + 1 < width) field[i] = Math.min(field[i], field[i - width + 1] + diagonal);
      }
    }
    for (let y = height - 1; y >= 0; y--) {
      for (let x = width - 1; x >= 0; x--) {
        const i = y * width + x;
        if (x + 1 < width) field[i] = Math.min(field[i], field[i + 1] + 1);
        if (y + 1 === height) continue;
        field[i] = Math.min(field[i], field[i + width] + 1);
        if (x > 0) field[i] = Math.min(field[i], field[i + width - 1] + diagonal);
        if (x + 1 < width) field[i] = Math.min(field[i], field[i + width + 1] + diagonal);
      }
    }
    return field;
  }

  function wash(path, [left, top, width, height], load, seed, color = INK) {
    const canvas = surface(width * RESOLUTION, height * RESOLUTION);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const w = canvas.width;
    const h = canvas.height;
    ctx.setTransform(RESOLUTION, 0, 0, RESOLUTION, -left * RESOLUTION, -top * RESOLUTION);
    ctx.fill(new Path2D(path));
    const mask = ctx.getImageData(0, 0, w, h).data;
    const outside = distances(mask, w, h, false);
    const inside = distances(mask, w, h, true);
    const pigment = ctx.createImageData(w, h);
    for (let j = 0; j < h; j++) {
      const y = top + (j + .5) / RESOLUTION;
      for (let i = 0; i < w; i++) {
        const distance = (outside[j * w + i] - inside[j * w + i]) / RESOLUTION;
        if (distance < -5) continue;
        const x = left + (i + .5) / RESOLUTION;
        const pool = noise(x * .075, y * .084, seed);
        const ripple = noise(x * .23, y * .19, seed + 263);
        const fiber = noise((x + y * .59) * .91, y * .48, seed + 51);
        const tooth = grain(i, j, seed + 557);
        const bleed = distance + (pool - .5) * 3.1 + (fiber - .53) * 2.05;
        const coverage = .84 * smooth(-1.4, 1.6, bleed) + .16 * smooth(-3.6, 1.1, bleed);
        const washDepth = load(x, y, pool) * (.47 + pool * .73 + ripple * .22);
        const lifted = 1 - smooth(.69, .98, fiber) * (.18 + (1 - coverage) * .7);
        const alpha = coverage * clamp(washDepth) * lifted * (.90 + tooth * .13);
        const offset = (j * w + i) * 4;
        const light = (ripple + fiber - 1) * 13;
        pigment.data[offset] = color[0] + light;
        pigment.data[offset + 1] = color[1] + light;
        pigment.data[offset + 2] = color[2] + light;
        pigment.data[offset + 3] = alpha * 255;
      }
    }
    ctx.putImageData(pigment, 0, 0);
    return { canvas, left, top, width, height };
  }

  function paint(ctx, stamp) {
    ctx.drawImage(stamp.canvas, stamp.left, stamp.top, stamp.width, stamp.height);
  }

  function tailPigment() {
    const width = TAIL_LENGTH * RESOLUTION;
    const height = 2 * TAIL_HALF_WIDTH * RESOLUTION;
    const opacity = new Uint8ClampedArray(width * height);
    for (let j = 0; j < height; j++) {
      const y = (j + .5) / RESOLUTION - TAIL_HALF_WIDTH;
      for (let i = 0; i < width; i++) {
        const t = (i + .5) / width;
        const center = Math.sin(PI * t) * 3.4;
        const radius = 9 * (1 - t) + 25 * Math.sin(PI * t) ** 1.02;
        const across = (y - center) / radius;
        if (Math.abs(across) > 1.55) continue;
        const pool = noise(t * 10.5, y * .117, 374);
        const twist = y + Math.sin(t * 9 + y * .17) * 1.12 + noise(t * 7, y * .13, 819) * 2.2;
        const fibers = noise(t * 4, twist * .81, 2795);
        const strands = noise(t * 19, twist * 1.71, 675);
        const paper = grain(i, j, 218);
        const edge = smooth(.65, 1.10, Math.abs(across));
        const dryness = Math.max(edge * .97, smooth(.35, .93, t) * .98);
        const bristle = smooth(.15 + dryness * .34, .50 + dryness * .28, fibers * .67 + strands * .28 + paper * .05);
        const edgeInk = 1 - smooth(.82, 1.18, Math.abs(across) + (pool - .50) * .37 - bristle * .19);
        const wetInk = .14 + smooth(-.88, .48, across + (pool - .5) * .93) * .86;
        opacity[j * width + i] = 255 * edgeInk * wetInk * mix(.98, bristle, dryness)
          * (.46 + .66 * pool) * (.89 + paper * .14);
      }
    }
    return { opacity, width, height };
  }

  function tailSurface() {
    const left = -197;
    const top = -154;
    const width = 156;
    const height = 144;
    const canvas = surface(width * RESOLUTION, height * RESOLUTION);
    const ctx = canvas.getContext('2d');
    const pixels = ctx.createImageData(canvas.width, canvas.height);
    for (let i = 0; i < pixels.data.length; i += 4) {
      pixels.data[i] = INK[0];
      pixels.data[i + 1] = INK[1];
      pixels.data[i + 2] = INK[2];
    }
    return { canvas, ctx, pixels, left, top, width, height };
  }

  function makeBrushes() {
    const body = wash(
      'M-66-79 C-71-87-57-101-41-100 C-21-105-9-90 5-91 C18-92 24-100 32-98 C41-97 46-93 47-84 C48-77 45-72 47-65 L52-70 Q47-56 37-48 L41-53 Q31-44 25-45 C13-46 9-54 0-56 C-13-60-19-56-29-47 L-26-52 Q-40-43-51-54 Q-59-61-66-79Z',
      [-77, -111, 142, 77],
      (x, y, pool) => {
        const ridge = -88 + 6 * Math.cos(x * .081) - 9 * smooth(6, 41, x);
        const shoulder = 1 - .69 * smooth(21, 47, x + (pool - .5) * 11);
        return .09 + .91 * shoulder * (1 - smooth(ridge - 7, ridge + 36, y + (pool - .5) * 14));
      }, 643);
    const neck = wash(
      'M-19 17 Q-19 4-12-9 L-17-6 C-16-15-7-22-4-32 Q3-46 18-39 C26-34 24-21 20-15 Q14-6 22 5 L17 1 Q19 14 10 24 L13 17 Q3 30-11 26Z',
      [-24, -47, 57, 81],
      (x, y, pool) => (.075 + .87 * (1 - smooth(-9, 17, x - y * .17 + (pool - .5) * 15)))
        * (1 - .95 * smooth(-6, 31, y)), 724);
    const profile = wash(
      'M-16 6 C-15 1-11-6-6-12 L-12-9 Q-5-17 8-16 C22-16 25-10 31-7 C34-6 38-7 48-7 Q51-6 49-2 C44 6 37 9 28 11 Q16 14 11 22 L11 16 Q3 19-4 18 L-2 14 Q-11 16-15 19 Q-11 10-16 6Z',
      [-22, -23, 80, 54],
      (x, y, pool) => {
        const crown = x < 22 ? mix(-8, -5, clamp(x / 22)) : mix(-5, -3, clamp((x - 22) / 26));
        return .07 + .91 * (1 - smooth(crown - 3, crown + 15, y + (pool - .5) * 8))
          * (1 - .40 * smooth(33, 49, x));
      }, 836);
    const front = wash(
      'M-21-6 L-16-7 Q-14-17 0-17 Q14-17 16-7 L21-6 Q18-4 23 0 L17 2 Q18 7 9 10 Q7 16 0 18 Q-7 16-9 10 Q-18 7-17 2 L-23 0Z',
      [-29, -23, 58, 48],
      (x, y, pool) => .07 + .90 * (1 - smooth(-10, 10, y - Math.abs(x) * .24 + (pool - .5) * 6)), 828);
    const ear = wash(
      'M-11 3 C-13-7-15-22-12-36 Q-11-39-8-34 C-1-29 8-17 11-6 L14-6 Q10 1 4 4Z',
      [-21, -44, 42, 56],
      (x, y) => .85 - .65 * (1 - smooth(3, 10, Math.abs(x + 5 - (y + 24) * .31)))
        * smooth(-36, -28, y) * (1 - smooth(-8, 2, y)), 341);
    const lining = wash(
      'M-9-31 Q-1-27 5-11 C3-11 3-9 2-7 Q-7-8-9-20 Q-10-26-9-31Z',
      [-16, -37, 27, 39],
      (x, y, pool) => .57 * (1 - smooth(-21, -7, y + (pool - .5) * 5)),
      929, [154, 68, 53]);
    const thigh = wash(
      'M-15 5 Q-15-10-3-15 C8-15 17-3 15 9 Q15 26 2 35 Q1 41 5 48 C1 50-6 49-8 44 Q-10 37-7 31 L-11 34 Q-9 22-15 5Z',
      [-22, -21, 46, 78],
      (x, y, pool) => .24 + .60 * (1 - smooth(-5, 13, x + (pool - .5) * 11))
        * (1 - .77 * smooth(9, 45, y)), 719);
    const foreleg = wash(
      'M-11 5 C-12-7-5-13 4-10 Q11-8 11 1 Q9 14 5 25 Q3 35 5 45 Q1 49-5 46 Q-8 40-7 33 Q-6 24-10 16 L-12 19Z',
      [-18, -16, 37, 70],
      (x, y, pool) => .13 + .52 * (1 - smooth(-4, 8, x + (pool - .5) * 9))
        * (.82 + .18 * smooth(14, 38, y)), 741);
    const shin = wash(
      'M-5-5 Q-4-9 4-5 Q6-3 5 7 L3 19 Q2 29 6 37 L-3 39 Q-7 33-6 24 L-6 15 Q-7 2-5-5Z',
      [-12, -14, 29, 60],
      (x, y) => (.17 + .45 * (1 - smooth(-4, 6, x))) * (.52 + .48 * smooth(-1, 12, y))
        + .24 * smooth(20, 38, y), 487);
    const paw = wash(
      'M-6-3 C-7-7 0-8 4-6 C8-5 11-2 10 1 Q7 5 1 3 Q-5 4-7 1Z',
      [-14, -13, 31, 25],
      (x, y, pool) => .42 + .51 * (1 - smooth(-3, 8, x + (pool - .5) * 4))
        + .07 * smooth(-1, 2, y), 212);
    const nose = wash('M-6-2 Q-1-4 4-3 Q7-3 5 0 Q2 4-1 4 L-4 1Z',
      [-11, -9, 23, 18], () => 1.19, 265);
    const shadow = surface(240, 34);
    const pencil = shadow.getContext('2d');
    pencil.scale(1, 34 / 240);
    const shade = pencil.createRadialGradient(120, 120, 14, 120, 120, 120);
    shade.addColorStop(0, 'rgba(33,30,27,.21)');
    shade.addColorStop(.55, 'rgba(33,30,27,.13)');
    shade.addColorStop(1, 'rgba(33,30,27,0)');
    pencil.fillStyle = shade;
    pencil.fillRect(0, 0, 240, 240);
    return { body, neck, profile, front, ear, lining, thigh, foreleg, shin, paw, nose, shadow,
      tail: tailSurface(), tailInk: tailPigment() };
  }

  function tailPoint(t, swing, breath) {
    const r = 1 - t;
    const y0 = -84 + breath;
    const y1 = -74;
    const y2 = -154 - 14 * swing;
    const y3 = -62 + 34 * swing;
    const dx = 3 * (-39 * r * r - 106 * r * t - 29 * t * t);
    const dy = 3 * ((y1 - y0) * r * r + 2 * (y2 - y1) * r * t + (y3 - y2) * t * t);
    const length = Math.hypot(dx, dy);
    return {
      x: -50 * r ** 3 - 267 * r ** 2 * t - 426 * r * t ** 2 - 171 * t ** 3,
      y: y0 * r ** 3 + 3 * y1 * r ** 2 * t + 3 * y2 * r * t ** 2 + y3 * t ** 3,
      nx: -dy / length,
      ny: dx / length
    };
  }

  function tailSection(t, swing, breath, target, texture) {
    const point = tailPoint(t, swing, breath);
    const width = TAIL_HALF_WIDTH;
    const u = t * (texture.width - 1);
    return [
      { x: (point.x - point.nx * width - target.left) * RESOLUTION,
        y: (point.y - point.ny * width - target.top) * RESOLUTION, u, v: 0 },
      { x: (point.x + point.nx * width - target.left) * RESOLUTION,
        y: (point.y + point.ny * width - target.top) * RESOLUTION, u, v: texture.height - 1 }
    ];
  }

  function warpInk(target, texture, a, b, c) {
    const abX = b.x - a.x;
    const abY = b.y - a.y;
    const acX = c.x - a.x;
    const acY = c.y - a.y;
    const area = abX * acY - abY * acX;
    if (Math.abs(area) < .001) return;
    const invArea = 1 / area;
    const stepS = acY * invArea;
    const stepT = -abY * invArea;
    const { data, width, height } = target.pixels;
    const left = Math.max(0, Math.floor(Math.min(a.x, b.x, c.x)));
    const right = Math.min(width - 1, Math.ceil(Math.max(a.x, b.x, c.x)));
    const top = Math.max(0, Math.floor(Math.min(a.y, b.y, c.y)));
    const bottom = Math.min(height - 1, Math.ceil(Math.max(a.y, b.y, c.y)));
    for (let y = top; y <= bottom; y++) {
      const py = y + .5 - a.y;
      const fromS = .5 * stepS - a.x * stepS - py * acX * invArea;
      const fromT = .5 * stepT - a.x * stepT + py * abX * invArea;
      for (let x = left; x <= right; x++) {
        const s = fromS + x * stepS;
        const t = fromT + x * stepT;
        if (s < -1e-7 || t < -1e-7 || s + t > 1 + 1e-7) continue;
        const u = Math.max(0, Math.min(texture.width - 1, a.u + (b.u - a.u) * s + (c.u - a.u) * t));
        const v = Math.max(0, Math.min(texture.height - 1, a.v + (b.v - a.v) * s + (c.v - a.v) * t));
        const ix = Math.min(texture.width - 2, Math.floor(u));
        const iy = Math.min(texture.height - 2, Math.floor(v));
        const row = iy * texture.width + ix;
        const upper = mix(texture.opacity[row], texture.opacity[row + 1], u - ix);
        const lower = mix(texture.opacity[row + texture.width], texture.opacity[row + texture.width + 1], u - ix);
        const alpha = mix(upper, lower, v - iy);
        const offset = (y * width + x) * 4 + 3;
        data[offset] = Math.max(data[offset], alpha);
      }
    }
  }

  function drawTail(ctx, swing, breath) {
    // Paint one continuous image on shared vertices before compositing over the river.
    const target = brushes.tail;
    const texture = brushes.tailInk;
    const { data } = target.pixels;
    for (let i = 3; i < data.length; i += 4) data[i] = 0;
    const pieces = 24;
    let section = tailSection(0, swing, breath, target, texture);
    for (let i = 1; i <= pieces; i++) {
      const next = tailSection(i / pieces, swing, breath, target, texture);
      warpInk(target, texture, section[0], section[1], next[0]);
      warpInk(target, texture, section[1], next[1], next[0]);
      section = next;
    }
    target.ctx.putImageData(target.pixels, 0, 0);
    paint(ctx, target);
  }

  const legs = [
    { hip: -47, foot: -37, phase: .51, hind: true, far: true },
    { hip: 29, foot: 37, phase: .74, hind: false, far: true },
    { hip: -47, foot: -64, phase: .01, hind: true, far: false },
    { hip: 28, foot: 22, phase: .24, hind: false, far: false }
  ];

  function limb(ctx, stamp, x, y, endX, endY, length, width) {
    const dx = endX - x;
    const dy = endY - y;
    const distance = Math.hypot(dx, dy) || 1;
    ctx.save();
    ctx.transform(dy * width / distance, -dx * width / distance, dx / length, dy / length, x, y);
    paint(ctx, stamp);
    ctx.restore();
  }

  function drawLeg(ctx, leg, fox, ground, breath, strideRatio) {
    const step = footCycle(fox.phase * strideRatio + leg.phase, fox.pace);
    const listen = !leg.hind && leg.far ? smooth(.51, .98, fox.look) * (1 - fox.pace) : 0;
    const x = leg.foot + step.x + 4.5 * listen;
    const lift = step.y - 12 * listen;
    const y = ground(x) + lift - (leg.far ? 4 : 1);
    const hipY = (leg.hind ? -76 : -70) + breath;
    const kneeX = leg.hip + (leg.hind ? 5 : 1) + (x - leg.hip) * (leg.hind ? .21 : .47) - lift * .24;
    const kneeY = mix(hipY, y, leg.hind ? .57 : .62) + lift * .12;
    const bend = leg.hind ? 3.4 : 1.4;
    ctx.save();
    ctx.globalAlpha *= leg.far ? .58 : .98;
    const width = leg.far ? .83 : 1;
    limb(ctx, brushes.shin, kneeX, kneeY - 2, x - bend, y, 36, width);
    limb(ctx, leg.hind ? brushes.thigh : brushes.foreleg,
      leg.hip, hipY, kneeX, kneeY, 44, width);
    ctx.translate(x, y);
    ctx.rotate(lift * -.017);
    ctx.scale(.82, .80);
    paint(ctx, brushes.paw);
    ctx.restore();
  }

  function drawEar(ctx, x, y, angle, size, shade, blush) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(size, size);
    const alpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha * shade;
    paint(ctx, brushes.ear);
    ctx.globalAlpha = alpha * blush;
    if (blush > 0) paint(ctx, brushes.lining);
    ctx.restore();
  }

  function drawEye(ctx, x, y, blink, scale) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    const lid = 1 - .91 * blink;
    ctx.fillStyle = '#2f2824';
    ctx.beginPath();
    ctx.moveTo(-6, 1.1);
    ctx.quadraticCurveTo(1.4, -6.1 * lid, 8.1, -1.7 * lid);
    ctx.quadraticCurveTo(3.6, -.3 + 3.1 * lid, -6, 1.1);
    ctx.fill();
    if (lid > .35) {
      ctx.fillStyle = 'rgba(248,243,231,.80)';
      ctx.beginPath();
      ctx.ellipse(2, -.45, .83, .66 * lid, 0, 0, 2 * PI);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMuzzle(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size, size);
    paint(ctx, brushes.nose);
    ctx.restore();
  }

  function drawProfile(ctx, fox) {
    drawEar(ctx, 11, -12, .54 + fox.ear * .21, .72, .67, 0);
    paint(ctx, brushes.profile);
    drawEar(ctx, -5, -10, -.08 - fox.ear * .19, .93, 1, .77);
    drawEye(ctx, 21, -3.4, fox.blink, 1);
    drawMuzzle(ctx, 46, -4, .86);
    ctx.fillStyle = 'rgba(35,30,27,.57)';
    ctx.beginPath();
    ctx.moveTo(45, .2);
    ctx.quadraticCurveTo(40, 5.7, 33, 6.2);
    ctx.quadraticCurveTo(40, 4.4, 45, .2);
    ctx.fill();
  }

  function drawFront(ctx, fox) {
    drawEar(ctx, -13, -9, -.31 - .17 * fox.ear, .85, .90, .59);
    drawEar(ctx, 13, -9, .49 + .14 * fox.ear, .84, .87, .29);
    paint(ctx, brushes.front);
    drawEye(ctx, -10, -2, fox.blink, .73);
    drawEye(ctx, 9.7, -2, fox.blink, -.73);
    drawMuzzle(ctx, .1, 10, .86);
  }

  function drawHead(ctx, fox, breath) {
    const yaw = Math.cos(fox.look * PI * .89);
    const profile = smooth(.12, .71, Math.abs(yaw));
    const facing = yaw < 0 ? -1 : 1;
    ctx.save();
    ctx.translate(27, -72 + breath);
    ctx.rotate(fox.sniff * .68 - fox.look * .27);
    paint(ctx, brushes.neck);
    ctx.translate(12 + yaw * 2, -36 - 4 * fox.look);
    ctx.rotate(-fox.sniff * .22 + fox.look * .17);
    if (profile < 1) {
      ctx.save();
      ctx.globalAlpha *= 1 - profile;
      ctx.translate(5 * yaw, 0);
      drawFront(ctx, fox);
      ctx.restore();
    }
    if (profile > 0) {
      ctx.globalAlpha *= profile;
      ctx.scale(facing * mix(.49, 1, Math.abs(yaw)), 1);
      drawProfile(ctx, fox);
    }
    ctx.restore();
  }

  function render(ctx, world, groundAt, actorScale = FOX_SCALE) {
    brushes ??= makeBrushes();
    const fox = world.fox;
    const scale = actorScale * .97;
    const scaleX = scale * fox.turnWidth * fox.facing;
    const y = groundAt(fox.x);
    const ground = x => (groundAt(fox.x + x * scaleX) - y) / scale;
    const breath = -Math.sin(world.time * 2.35) * .81 - Math.cos(fox.phase * 4 * PI) * 1.65 * fox.pace;
    ctx.save();
    ctx.translate(fox.x, y);
    ctx.scale(scaleX, scale);
    ctx.drawImage(brushes.shadow, -89, -9, 150, 19);
    drawTail(ctx, fox.tail, breath);
    for (const leg of legs) drawLeg(ctx, leg, fox, ground, breath, FOX_SCALE / scale);
    ctx.save();
    ctx.translate(0, breath);
    paint(ctx, brushes.body);
    ctx.restore();
    drawHead(ctx, fox, breath);
    ctx.restore();
  }

  globalThis.InkBrushFox = { render };
})();
