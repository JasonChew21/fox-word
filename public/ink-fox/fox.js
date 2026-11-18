(function () {
  'use strict';

  const { footCycle, FOX_SCALE, randomFrom } = globalThis.InkFoxMotion;
  const TAU = Math.PI * 2;
  const paths = {
    torso: new Path2D('M-65 -69C-64 -84-52 -93-33 -90C-14 -90-4 -84 14 -87C31 -91 46 -89 52 -79C57 -69 52 -60 42 -53L38 -48Q34 -45 30 -49Q25 -44 21 -48C7 -46-8 -51-25 -53Q-36 -51-42 -48L-45 -51Q-53 -46-60 -53C-68 -57-69 -64-65 -69Z'),
    belly: new Path2D('M-60 -64C-45 -66-39 -62-23 -61Q-15 -62-8 -57L-4 -59L4 -55L11 -57L16 -53L22 -57L27 -54Q34 -63 48 -67C55 -49 32 -41 16 -42L-45 -46L-66 -51Z'),
    shoulder: new Path2D('M22 -84C28 -88 41 -87 49 -80C42 -79 37 -72 34 -65Q30 -57 26 -58L28 -63L24 -61L25 -68Q21 -67 21 -70L18 -67Q18 -78 22 -84Z'),
    haunch: new Path2D('M-61 -74C-54 -87-42 -88-32 -81C-26 -72-31 -59-42 -54Q-52 -52-58 -61Q-62 -67-61 -74Z'),
    ear: new Path2D('M-11 5C-14 -7-14 -20-9 -34Q-8 -38-5 -34Q7 -24 13 -14Q16 -5 11 4Z'),
    earInner: new Path2D('M-7 -1Q-11 -15-7 -28Q1 -25 8 -12Q12 -7 8 -3L7 2 2 -1-1 4Z')
  };
  const positions = [
    { ax: -48, ay: -64, foot: -48, phase: .50, rear: true, near: false },
    { ax:  37, ay: -65, foot:  51, phase: .75, rear: false, near: false },
    { ax: -48, ay: -64, foot: -57, phase:  .0, rear: true, near: true },
    { ax:  35, ay: -65, foot:  38, phase: .25, rear: false, near: true }
  ];

  const rnd = randomFrom(529017);
  const pigment = Array.from({ length: 160 }, () => ({
    x: -69 + rnd() * 127, y: -94 + rnd() * 51, w: .3 + rnd() * 2.8,
    h: .24 + rnd() * .47, dark: rnd() < .51
  }));

  function fill(ctx, path, color) {
    ctx.fillStyle = color;
    ctx.fill(path);
  }

  function outline(ctx, path, width = 1.05, color = 'rgba(48,41,39,.73)') {
    ctx.lineWidth = width;
    ctx.strokeStyle = color;
    ctx.stroke(path);
  }

  function gradient(ctx, x0, y0, x1, y1, stops) {
    const paint = ctx.createLinearGradient(x0, y0, x1, y1);
    for (const [offset, color] of stops) paint.addColorStop(offset, color);
    return paint;
  }

  function wash(ctx, path, x, y, radius, color) {
    const paint = ctx.createRadialGradient(x, y, 0, x, y, radius);
    paint.addColorStop(0, color);
    paint.addColorStop(1, 'rgba(82,55,51,0)');
    fill(ctx, path, paint);
  }

  function drawTail(ctx, fox, bob, time) {
    const sway = fox.tail * 22 + Math.sin(time * 1.8 - .67) * 3.1;
    const mid = sway * .46, tip = sway + fox.pace * 3;
    const tail = new Path2D();
    tail.moveTo(-56, -74 + bob);
    tail.bezierCurveTo(-80, -71 + bob, -92, -53 + mid, -113, -50 + mid);
    tail.bezierCurveTo(-132, -50 + mid, -144, -55 + tip, -164, -50 + tip);
    tail.quadraticCurveTo(-171, -48 + tip, -175, -44 + tip);
    tail.quadraticCurveTo(-168, -40 + tip, -162, -39 + tip);
    tail.lineTo(-164, -37 + tip);
    tail.bezierCurveTo(-144, -27 + tip, -119, -22 + mid, -95, -32 + mid);
    tail.bezierCurveTo(-77, -37 + mid, -66, -50 + bob, -52, -55 + bob);
    tail.closePath();

    ctx.save();
    ctx.clip(tail);
    ctx.fillStyle = gradient(ctx, -48, -76, -85, -17, [
      [0, '#c8806d'], [.42, '#b56556'], [.75, '#935248'], [1, '#674543']
    ]);
    ctx.fillRect(-180, -99, 138, 105);
    const tipMask = new Path2D();
    tipMask.moveTo(-180, -77 + tip);
    tipMask.lineTo(-142, -68 + tip);
    tipMask.lineTo(-128, -55 + tip);
    tipMask.lineTo(-137, -49 + tip);
    tipMask.lineTo(-129, -47 + tip);
    tipMask.lineTo(-141, -42 + tip);
    tipMask.lineTo(-131, -40 + tip);
    tipMask.lineTo(-143, -34 + tip);
    tipMask.lineTo(-138, -24 + tip);
    tipMask.lineTo(-180, -12 + tip);
    tipMask.closePath();
    fill(ctx, tipMask, gradient(ctx, -165, -56 + tip, -143, -26 + tip, [
      [0, '#e9e2d9'], [.51, '#d7cec4'], [1, '#a89a94']
    ]));
    wash(ctx, tail, -99, -36 + mid, 39, 'rgba(76,35,31,.22)');
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const lineY = -64 + i * 3.45;
      ctx.strokeStyle = i % 2 ? 'rgba(250,224,205,.20)' : 'rgba(68,41,38,.16)';
      ctx.lineWidth = .53 + (i % 3) * .18;
      ctx.beginPath();
      ctx.moveTo(-64 - i * 6.4, lineY + bob);
      ctx.bezierCurveTo(-100, lineY + 16 + mid, -129, lineY + 14 + tip, -160 - i, lineY + 14.4 + tip);
      ctx.stroke();
    }
    ctx.restore();
    outline(ctx, tail, 1.05, 'rgba(63,45,43,.66)');
  }

  function drawLeg(ctx, leg, x, y, bob) {
    const rootX = leg.ax, rootY = leg.ay + bob;
    const kneeX = rootX + (leg.rear ? 13 : -3.5) + (x - leg.foot) * .37;
    const kneeY = rootY + (leg.rear ? 26 : 25) + Math.min(0, y * .25);
    const hockX = x + (leg.rear ? -5.8 : -1.4);
    const hockY = y - (leg.rear ? 19.6 : 14.7);
    const width = leg.rear ? 9.9 : 7.5;
    const shape = new Path2D();
    shape.moveTo(rootX - width, rootY - 5);
    shape.bezierCurveTo(rootX - width - 4, rootY + 9, kneeX - 5, kneeY - 9, kneeX - 5, kneeY);
    shape.quadraticCurveTo(hockX - 5, hockY - 5, hockX - 4.1, hockY);
    shape.quadraticCurveTo(x - 4.8, y - 8, x - 4.3, y - 2.5);
    shape.quadraticCurveTo(x - 4.6, y - .2, x - 1.7, y);
    shape.lineTo(x + 5.5, y);
    shape.quadraticCurveTo(x + 9.2, y - .7, x + 7.2, y - 3);
    shape.quadraticCurveTo(x + 7.5, y - 5.3, x + 3.2, y - 5.6);
    shape.quadraticCurveTo(hockX + 4.0, hockY + 3.5, hockX + 3.8, hockY);
    shape.bezierCurveTo(hockX + 4.6, hockY - 6, kneeX + 8.3, kneeY + 2, kneeX + 7.4, kneeY - 1);
    shape.quadraticCurveTo(rootX + width + 2.9, rootY + 13.5, rootX + width, rootY - 4.6);
    shape.closePath();
    fill(ctx, shape, gradient(ctx, rootX, rootY + 4, x, y, leg.near
      ? [[0, '#bf7665'], [.37, '#a25e53'], [.68, '#5b4845'], [1, '#3c3533']]
      : [[0, '#9b6459'], [.40, '#7e554f'], [.72, '#544442'], [1, '#4a413e']]));
    outline(ctx, shape, .9, leg.near ? 'rgba(57,44,41,.69)' : 'rgba(64,49,45,.43)');
    if (leg.near) {
      const shine = new Path2D();
      shine.moveTo(kneeX - 1.8, kneeY - 9);
      shine.quadraticCurveTo(kneeX - 1.5, kneeY + 3, hockX - 1.1, hockY + .6);
      shine.quadraticCurveTo(x -.2, y - 8, x + .1, y - 5.4);
      outline(ctx, shine, .7, 'rgba(246,216,201,.24)');
      const toes = new Path2D();
      toes.moveTo(x + 3.9, y - 2.7);
      toes.lineTo(x + 3.9, y - 1.1);
      toes.moveTo(x + 5.4, y - 2.3);
      toes.lineTo(x + 5.7, y - 1);
      outline(ctx, toes, .58, 'rgba(223,203,193,.35)');
    }
  }

  function drawBody(ctx, bob) {
    ctx.save();
    ctx.translate(0, bob);
    fill(ctx, paths.torso, gradient(ctx, -17, -91, -7, -46, [
      [0, '#ce8a78'], [.34, '#bb6f5e'], [.74, '#aa6255'], [1, '#82504a']
    ]));
    wash(ctx, paths.torso, -41, -79, 36, 'rgba(158,72,58,.35)');
    ctx.save();
    ctx.clip(paths.torso);
    fill(ctx, paths.belly, gradient(ctx, 3, -70, 0, -44, [
      [0, '#c5a195'], [.55, '#d8c3b6'], [1, '#b8a096']
    ]));
    wash(ctx, paths.haunch, -54, -83, 26, 'rgba(111,57,48,.22)');
    fill(ctx, paths.shoulder, 'rgba(245,196,172,.28)');
    for (const mark of pigment) {
      ctx.fillStyle = mark.dark ? 'rgba(75,39,38,.095)' : 'rgba(250,223,203,.15)';
      ctx.beginPath();
      ctx.ellipse(mark.x, mark.y, mark.w, mark.h, -.19, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    outline(ctx, paths.torso);
    outline(ctx, new Path2D('M-56 -81Q-46 -89-28 -86Q-20 -85-13 -84M-2 -82Q10 -79 20 -84M-57 -68Q-55 -61-49 -56M41 -66Q38 -60 34 -56'), .87, 'rgba(242,206,184,.45)');
    const fur = new Path2D('M-65 -67Q-61 -75-54 -78M-45 -83Q-39 -85-35 -83M-35 -78Q-28 -80-21 -77M-29 -71Q-24 -73-14 -71M-11 -75Q-2 -73 8 -74M3 -65Q12 -64 20 -69M-53 -58Q-47 -55-44 -55M-23 -55L-15 -56M10 -51Q15 -49 19 -53');
    outline(ctx, fur, .66, 'rgba(91,47,42,.28)');
    ctx.restore();
  }

  function drawNeck(ctx, bob, hx, hy) {
    const neck = new Path2D();
    neck.moveTo(22, -82 + bob);
    neck.bezierCurveTo(28, -89 + bob, hx - 19, hy - 8, hx - 8, hy - 15);
    neck.bezierCurveTo(hx + 7, hy - 19, hx + 22, hy - 5, hx + 15, hy + 11);
    neck.quadraticCurveTo(57, -70 + bob, 55, -62 + bob);
    neck.lineTo(51, -66 + bob);
    neck.quadraticCurveTo(54, -58 + bob, 44, -53 + bob);
    neck.lineTo(44, -57 + bob);
    neck.lineTo(37, -51 + bob);
    neck.lineTo(36, -56 + bob);
    neck.quadraticCurveTo(30, -52 + bob, 25, -51 + bob);
    neck.quadraticCurveTo(35, -62 + bob, 25, -69 + bob);
    neck.quadraticCurveTo(33, -74 + bob, 22, -82 + bob);
    neck.closePath();
    fill(ctx, neck, gradient(ctx, 31, hy - 16, 45, -50 + bob,
      [[0, '#b86d5d'], [.26, '#c88471'], [.51, '#eee4d9'], [1, '#c2b3ab']]));
    wash(ctx, neck, 31, -65 + bob, 18, 'rgba(106,64,54,.19)');
    outline(ctx, neck, .76, 'rgba(80,58,51,.50)');
    const marks = new Path2D();
    marks.moveTo(hx - 10, hy + 9);
    marks.quadraticCurveTo(40, -68 + bob, 34, -60 + bob);
    marks.moveTo(hx - 2, hy + 13);
    marks.quadraticCurveTo(46, -69 + bob, 42, -62 + bob);
    marks.moveTo(hx + 5, hy + 12);
    marks.quadraticCurveTo(51, -72 + bob, 49, -65 + bob);
    outline(ctx, marks, .79, 'rgba(124,101,91,.32)');
  }

  function drawEar(ctx, x, y, angle, scale, near) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(scale, scale);
    fill(ctx, paths.ear, gradient(ctx, 0, -37, 0, 5, near
      ? [[0, '#393333'], [.36, '#694843'], [.69, '#b66c5d'], [1, '#c88a76']]
      : [[0, '#463d3b'], [.5, '#7b5550'], [1, '#a96557']]));
    fill(ctx, paths.earInner, gradient(ctx, -7, -33, 6, 3,
      [[0, '#7c5650'], [.51, '#c39688'], [1, '#e8c0ac']]));
    outline(ctx, paths.ear, near ? 1 : .86, 'rgba(51,39,36,.76)');
    outline(ctx, new Path2D('M-9 -24Q-10 -13-8 -6M-4 -23Q1 -18 3 -13M-5 -11L-3 -4M1 -11L4 -5'),
      .67, 'rgba(255,231,212,.34)');
    ctx.restore();
  }

  function eye(ctx, x, y, blink, small = false) {
    const openness = 1 - blink * .89;
    ctx.save();
    ctx.translate(x, y);
    if (small) ctx.scale(.77, .83);
    const lid = new Path2D();
    lid.moveTo(-5.4, 1.1);
    lid.quadraticCurveTo(-.8, -6.2 * openness, 5.7, -.35);
    lid.quadraticCurveTo(1.3, 4.9 * openness, -5.4, 1.1);
    fill(ctx, lid, '#372e2b');
    if (openness > .33) {
      ctx.fillStyle = '#bf9987';
      ctx.beginPath();
      ctx.ellipse(2.25, -.52, 1.94, 2.46 * openness, -.18, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fbede1';
      ctx.beginPath();
      ctx.arc(2.1, -.91 - .65 * openness, .89, 0, TAU);
      ctx.fill();
    }
    outline(ctx, new Path2D('M-6 -2.6Q-3 -6.9 2.3 -6.3'), .72, 'rgba(75,44,36,.58)');
    ctx.restore();
  }

  function drawHead(ctx, fox, hx, hy, time) {
    const view = 1 - 1.89 * fox.look;
    const side = view < 0 ? -1 : 1;
    const profile = Math.abs(view);
    const nose = 15 + 29 * profile;
    const bridge = 11 + 10 * profile;
    const twitch = fox.ear * .34 + Math.sin(time * 1.5) * .018;
    ctx.save();
    ctx.translate(hx, hy);
    ctx.rotate(fox.sniff * .35 - fox.look * .07 + Math.sin(fox.phase * 4 * Math.PI + .8) * .034 * fox.pace);
    ctx.scale(side, 1);
    drawEar(ctx, 10, -18, .30 - twitch * .34, .79, false);
    drawEar(ctx, -9, -21, -.20 - twitch, 1, true);

    const skull = new Path2D();
    skull.moveTo(-21, -7);
    skull.bezierCurveTo(-20, -18, -12, -26, -1, -25);
    skull.bezierCurveTo(7, -26, bridge - 1, -21, bridge, -13);
    skull.bezierCurveTo(bridge + 1, -7, nose - 13, -2, nose - 4, -.3);
    skull.quadraticCurveTo(nose + 1, .4, nose, 4.8);
    skull.quadraticCurveTo(nose - 3, 9, nose - 12, 10.3);
    skull.bezierCurveTo(bridge - 3, 15.9, 4, 17.6, -7, 14.3);
    skull.lineTo(-16, 18);
    skull.lineTo(-15, 13);
    skull.lineTo(-23, 15);
    skull.lineTo(-19, 9);
    skull.lineTo(-24, 8);
    skull.quadraticCurveTo(-21, 3, -22, -1);
    skull.closePath();

    fill(ctx, skull, gradient(ctx, 2, -26, 10, 17,
      [[0, '#d5917c'], [.42, '#c67967'], [.72, '#b36658'], [1, '#996056']]));
    ctx.save();
    ctx.clip(skull);
    const cheek = new Path2D();
    cheek.moveTo(-22, 4);
    cheek.quadraticCurveTo(-9, 8, 2, 3);
    cheek.quadraticCurveTo(bridge, -1.8, nose + 1, 2.8);
    cheek.lineTo(nose + 9, 25);
    cheek.lineTo(-25, 22);
    cheek.closePath();
    fill(ctx, cheek, gradient(ctx, 0, 3, 1, 18, [[0, '#f0e6da'], [.64, '#e1d3c7'], [1, '#bbaba2']]));
    wash(ctx, skull, -17, -1, 20, 'rgba(102,61,55,.31)');
    ctx.restore();
    outline(ctx, skull, 1, 'rgba(55,41,37,.75)');
    outline(ctx, new Path2D('M-18 -11Q-13 -24-2 -24M-12 -18L-8 -21M-18 -5L-14 -10M-13 6L-3 4M-16 11L-11 8'), .64, 'rgba(255,234,216,.51)');
    eye(ctx, 3.5 + profile * 10.8, -7.8 - profile * .52, fox.blink);
    if (profile < .41) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, (.41 - profile) * 5);
      eye(ctx, -8.3, -8.0, fox.blink, true);
      ctx.restore();
    }
    ctx.fillStyle = '#3e3432';
    ctx.beginPath();
    ctx.ellipse(nose - 2.65, 2.72, 3.3, 2.73, -.09, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(249,230,215,.62)';
    ctx.beginPath();
    ctx.ellipse(nose - 2.7, 1.48, 1.12, .48, 0, 0, TAU);
    ctx.fill();

    const marks = new Path2D();
    marks.moveTo(nose - 2.2, 4.5);
    marks.quadraticCurveTo(nose - 4.8, 8.6, nose - 13 - profile * 4, 8.9);
    marks.moveTo(nose - 12, 1.4);
    marks.quadraticCurveTo(nose - 4, 1.7, nose + 3, .2);
    marks.moveTo(nose - 12, 3.9);
    marks.quadraticCurveTo(nose - 4, 4.6, nose + 3, 6.1);
    outline(ctx, marks, .61, 'rgba(68,49,45,.58)');
    ctx.restore();
  }

  function render(ctx, world, groundAt, actorScale = FOX_SCALE) {
    const fox = world.fox;
    const y = groundAt(fox.x);
    const bob = Math.cos(fox.phase * 4 * Math.PI) * 1.38 * fox.pace + Math.sin(world.time * 2.1) * .43;
    const scaleX = actorScale * fox.turnWidth * fox.facing;
    const headX = 47 + fox.sniff * 10.2 - fox.look * 4.4;
    const headY = -87 + fox.sniff * 26.5 - fox.look * 5.2 + bob;
    ctx.save();
    ctx.translate(fox.x, y);
    ctx.scale(1, .14);
    const shadow = ctx.createRadialGradient(-14, 0, 6, -14, 0, 114);
    shadow.addColorStop(0, 'rgba(61,53,50,.27)');
    shadow.addColorStop(.63, 'rgba(56,50,48,.13)');
    shadow.addColorStop(1, 'rgba(56,50,48,0)');
    ctx.fillStyle = shadow;
    ctx.fillRect(-130, -113, 237, 226);
    ctx.restore();

    ctx.save();
    ctx.translate(fox.x, y);
    ctx.scale(scaleX, actorScale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    function legAt(leg) {
      const step = footCycle(fox.phase * FOX_SCALE / actorScale + leg.phase, fox.pace);
      const x = leg.foot + step.x;
      const ground = (groundAt(fox.x + x * scaleX) - y) / actorScale;
      drawLeg(ctx, leg, x, ground + step.y - (leg.near ? 0 : 2.7), bob);
    }

    drawTail(ctx, fox, bob, world.time);
    legAt(positions[0]);
    legAt(positions[1]);
    legAt(positions[2]);
    legAt(positions[3]);
    drawBody(ctx, bob);
    drawNeck(ctx, bob, headX, headY);
    drawHead(ctx, fox, headX, headY, world.time);
    ctx.restore();
  }

  globalThis.InkFoxArt = { render };
})();
