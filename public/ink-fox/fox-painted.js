(function () {
  'use strict';

  const imageWidth = 266;
  const originX = .57;
  const originY = .947;
  const padX = .07;
  const padY = .09;
  const sourceWidth = 1692;
  const sourceHeight = 930;
  const groundPatch = { x: 1228, y: 478, width: 344, height: 446 };
  // Corresponding cross sections of the far foreleg in original illustration pixels.
  // Each section is [y, left, center, right], first at rest and then lifted.
  const foreleg = [
    [[488, 1294, 1359, 1458], [488, 1294, 1359, 1458]],
    [[522, 1286, 1353, 1433], [523, 1299, 1355, 1437]],
    [[556, 1280, 1334, 1409], [544, 1303, 1377, 1446]],
    [[584, 1267, 1310, 1375], [562, 1328, 1411, 1465]],
    [[622, 1271, 1321, 1368], [586, 1354, 1424, 1470]],
    [[658, 1276, 1329, 1378], [607, 1362, 1420, 1466]],
    [[708, 1284, 1338, 1385], [632, 1355, 1408, 1457]],
    [[756, 1301, 1348, 1397], [653, 1344, 1400, 1447]],
    [[804, 1320, 1368, 1428], [668, 1340, 1393, 1440]],
    [[831, 1340, 1395, 1470], [679, 1336, 1389, 1433]],
    [[849, 1348, 1418, 1478], [691, 1334, 1382, 1426]],
    [[868, 1352, 1417, 1480], [706, 1334, 1380, 1421]],
    [[895, 1354, 1417, 1488], [735, 1334, 1380, 1430]]
  ];
  const feet = [
    [.323, .952, .053, .18],
    [.568, .927, .051, .14],
    [.771, .950, .053, .20],
    [.837, .923, .050, .16]
  ];
  let painting;
  let puppet;
  let shadow;

  const vertexShader = `
    attribute vec2 texCoord;
    attribute vec2 raisedCoord;
    uniform vec4 pose;
    uniform vec4 detail;
    uniform float aspect;
    uniform mediump float pawHeight;
    varying vec2 sampleAt;
    varying vec2 sampleRaisedAt;

    void main() {
      vec2 p = mix(texCoord, raisedCoord, pawHeight);
      float time = pose.x;
      float tail = 1.0 - smoothstep(.06, .47, p.x);
      float wave = sin(time * 1.9 + p.x * 12.0 + p.y * 2.0);
      p.y += tail * (pose.w * .080 + wave * .008);
      p.x += tail * (.012 * wave - .012 * pose.w);

      float breath = sin(time * 2.3) * .0055;
      float ribs = smoothstep(.34, .58, p.x) * (1.0 - smoothstep(.78, .88, p.x));
      p.y -= breath * ribs * (1.0 - smoothstep(.34, .68, p.y));

      vec2 eye = vec2(.882, .159);
      vec2 eyeOffset = texCoord - eye;
      float lid = (1.0 - smoothstep(.006, .038, abs(eyeOffset.x)))
                * (1.0 - smoothstep(.006, .031, abs(eyeOffset.y)));
      p.y -= detail.y * lid * eyeOffset.y * .87;

      vec2 hinge = vec2(.757, .329);
      vec2 neck = (p - hinge) * vec2(aspect, 1.0);
      float angle = .234 * pose.z - .129 * pose.y;
      float c = cos(angle);
      float s = sin(angle);
      vec2 rotated = vec2(c * neck.x - s * neck.y, s * neck.x + c * neck.y);
      float head = smoothstep(.687, .793, p.x) * (1.0 - smoothstep(.27, .49, p.y));
      p += (rotated - neck) / vec2(aspect, 1.0) * head;

      float earTip = 1.0 - smoothstep(.022, .164, texCoord.y);
      float nearEar = smoothstep(.75, .79, texCoord.x) * (1.0 - smoothstep(.819, .842, texCoord.x));
      float farEar = smoothstep(.826, .850, texCoord.x) * (1.0 - smoothstep(.87, .899, texCoord.x));
      p += earTip * detail.x * (vec2(-.020, -.014) * nearEar + vec2(.007, -.009) * farEar);

      p.y += (p.x - ${originX}) * detail.z * aspect * smoothstep(.43, ${originY}, p.y);
      sampleAt = texCoord;
      sampleRaisedAt = raisedCoord;
      gl_Position = vec4((p.x - .5) / (.5 + ${padX}), (.5 - p.y) / (.5 + ${padY}), 0., 1.);
    }
  `;

  const fragmentShader = `
    precision mediump float;
    uniform sampler2D ink;
    uniform sampler2D raisedInk;
    uniform mediump float pawHeight;
    varying vec2 sampleAt;
    varying vec2 sampleRaisedAt;

    void main() {
      if (pawHeight < .002) {
        gl_FragColor = texture2D(ink, sampleAt);
      } else if (pawHeight > .998) {
        gl_FragColor = texture2D(raisedInk, sampleRaisedAt);
      } else {
        gl_FragColor = mix(texture2D(ink, sampleAt), texture2D(raisedInk, sampleRaisedAt), pawHeight);
      }
    }
  `;

  function surface(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    return canvas;
  }

  function removePaper(image, groundedPatch) {
    const { width, height } = image;
    const canvas = surface(width, height);
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(image, 0, 0);
    if (groundedPatch) {
      const { x, y, width: w, height: h } = groundPatch;
      ctx.drawImage(groundedPatch, x * width / sourceWidth, y * height / sourceHeight,
        w * width / sourceWidth, h * height / sourceHeight);
    }
    const pixels = ctx.getImageData(0, 0, width, height);
    const { data } = pixels;
    const paper = [0, 0, 0];
    let samples = 0;
    // This margin contains blank paper in the source illustration.
    for (let y = 5; y < height * .085; y += 3) {
      for (let x = 8; x < width * .70; x += 7) {
        const offset = (y * width + x) * 4;
        for (let channel = 0; channel < 3; channel++) paper[channel] += data[offset + channel];
        samples++;
      }
    }
    const [r, g, b] = paper.map(value => value / samples);
    for (let i = 0; i < data.length; i += 4) {
      const red = data[i] / r;
      const green = data[i + 1] / g;
      const blue = data[i + 2] / b;
      // Solve the pigment color against the paper, then discard the faint paper grain.
      const density = 1 - Math.min(red, green, blue);
      const ink = Math.min(1, Math.max(0, density * 1.12));
      const edge = Math.min(1, Math.max(0, (density - .042) / .105));
      data[i + 3] = ink * edge * edge * (3 - 2 * edge) * 255;
      if (ink > 0) {
        data[i] = 255 * (1 + (red - 1) / ink);
        data[i + 1] = 255 * (1 + (green - 1) / ink);
        data[i + 2] = 255 * (1 + (blue - 1) / ink);
      }
    }
    ctx.putImageData(pixels, 0, 0);
    return canvas;
  }

  function ease(value) {
    const t = Math.min(1, Math.max(0, value));
    return t * t * (3 - 2 * t);
  }

  function splitForeleg(source, pose, keepBody) {
    const canvas = surface(source.width, source.height);
    const ctx = canvas.getContext('2d');
    const src = source.getContext('2d');
    const { width, height } = source;
    const image = src.getImageData(0, 0, width, height);
    const leg = ctx.createImageData(width, height);
    const rows = foreleg.map(pair => pair[pose]);
    const first = rows[0][0];
    const last = rows[rows.length - 1][0];
    let section = 0;
    for (let py = Math.ceil(first * height / sourceHeight); py < last * height / sourceHeight; py++) {
      const y = (py + .5) * sourceHeight / height;
      while (section < rows.length - 2 && y > rows[section + 1][0]) section++;
      const [y0, left0, , right0] = rows[section];
      const [y1, left1, , right1] = rows[section + 1];
      const t = (y - y0) / (y1 - y0);
      const left = left0 + (left1 - left0) * t;
      const right = right0 + (right1 - right0) * t;
      const fadeY = ease((y - first) / 44) * ease((last - y) / 20);
      for (let px = Math.ceil(left * width / sourceWidth); px < right * width / sourceWidth; px++) {
        const x = (px + .5) * sourceWidth / width;
        const feather = fadeY * ease((x - left) / 20) * ease((right - x) / 18);
        const offset = (py * width + px) * 4;
        const alpha = image.data[offset + 3] / 255;
        const opacity = alpha * feather;
        leg.data[offset] = image.data[offset];
        leg.data[offset + 1] = image.data[offset + 1];
        leg.data[offset + 2] = image.data[offset + 2];
        leg.data[offset + 3] = opacity * 255;
        // Compositing the body over the lifted layer reconstructs the original alpha.
        if (keepBody) image.data[offset + 3] = opacity === 1 ? 0 : (alpha - opacity) / (1 - opacity) * 255;
      }
    }
    ctx.putImageData(leg, 0, 0);
    if (keepBody) src.putImageData(image, 0, 0);
    return canvas;
  }

  function makeShadow() {
    const canvas = surface(96, 32);
    const ctx = canvas.getContext('2d');
    ctx.scale(1, 1 / 3);
    const soft = ctx.createRadialGradient(48, 48, 1, 48, 48, 48);
    soft.addColorStop(0, '#322b26');
    soft.addColorStop(.38, 'rgba(50,43,38,.62)');
    soft.addColorStop(1, 'rgba(50,43,38,0)');
    ctx.fillStyle = soft;
    ctx.fillRect(0, 0, 96, 96);
    return canvas;
  }

  function compile(gl, type, text) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, text);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
  }

  function createPuppet(body, plantedLeg, raisedLeg) {
    const canvas = surface(Math.round(body.width * (1 + 2 * padX)), Math.round(body.height * (1 + 2 * padY)));
    const gl = canvas.getContext('webgl', { antialias: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const program = gl.createProgram();
    const vs = compile(gl, gl.VERTEX_SHADER, vertexShader);
    const fs = compile(gl, gl.FRAGMENT_SHADER, fragmentShader);
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);

    // Adjacent triangles share vertex positions so the ink runs through them as one painting.
    const cols = 52;
    const rows = 40;
    const bodyMesh = [];
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const left = x / cols;
        const right = (x + 1) / cols;
        const top = y / rows;
        const bottom = (y + 1) / rows;
        for (const [u, v] of [[left, top], [left, bottom], [right, top], [right, top], [left, bottom], [right, bottom]]) {
          bodyMesh.push(u, v, u, v);
        }
      }
    }

    // Both leg textures share this topology. The toe and joint landmarks stay aligned
    // during the blend because each pair occupies the same moving triangles.
    const legMesh = [];
    function pawVertex(row, column) {
      const [down, up] = foreleg[row];
      legMesh.push(down[column] / sourceWidth, down[0] / sourceHeight,
        up[column] / sourceWidth, up[0] / sourceHeight);
    }
    for (let row = 0; row < foreleg.length - 1; row++) {
      for (let col = 1; col < 3; col++) {
        pawVertex(row, col);
        pawVertex(row + 1, col);
        pawVertex(row, col + 1);
        pawVertex(row, col + 1);
        pawVertex(row + 1, col);
        pawVertex(row + 1, col + 1);
      }
    }

    function buffer(mesh) {
      const vbo = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(mesh), gl.STATIC_DRAW);
      return vbo;
    }
    const bodyVbo = buffer(bodyMesh);
    const legVbo = buffer(legMesh);
    const coordinates = gl.getAttribLocation(program, 'texCoord');
    const raisedCoordinates = gl.getAttribLocation(program, 'raisedCoord');
    gl.enableVertexAttribArray(coordinates);
    gl.enableVertexAttribArray(raisedCoordinates);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);

    function upload(source) {
      const texture = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      return texture;
    }
    const bodyInk = upload(body);
    const restInk = upload(plantedLeg);
    const liftInk = upload(raisedLeg);
    gl.uniform1i(gl.getUniformLocation(program, 'ink'), 0);
    gl.uniform1i(gl.getUniformLocation(program, 'raisedInk'), 1);
    gl.uniform1f(gl.getUniformLocation(program, 'aspect'), body.width / body.height);
    gl.viewport(0, 0, canvas.width, canvas.height);
    const pose = gl.getUniformLocation(program, 'pose');
    const detail = gl.getUniformLocation(program, 'detail');
    const pawHeight = gl.getUniformLocation(program, 'pawHeight');

    function drawLayer(vbo, count, ink, raisedInk, lift) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.vertexAttribPointer(coordinates, 2, gl.FLOAT, false, 16, 0);
      gl.vertexAttribPointer(raisedCoordinates, 2, gl.FLOAT, false, 16, 8);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, ink);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, raisedInk);
      gl.uniform1f(pawHeight, lift);
      gl.drawArrays(gl.TRIANGLES, 0, count);
    }

    return {
      canvas,
      draw(world, slope) {
        if (gl.isContextLost()) return false;
        const { time, fox } = world;
        gl.uniform4f(pose, time, fox.look, fox.sniff, fox.tail);
        gl.uniform4f(detail, fox.ear, fox.blink, slope, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        drawLayer(legVbo, legMesh.length / 4, restInk, liftInk, fox.paw);
        drawLayer(bodyVbo, bodyMesh.length / 4, bodyInk, bodyInk, 0);
        return true;
      }
    };
  }

  function loadSource(file) {
    // The encoded source keeps pixel reads available when the page opens via file://.
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = file;
      script.addEventListener('load', resolve, { once: true });
      script.addEventListener('error', reject, { once: true });
      document.head.appendChild(script);
    });
  }

  async function decode(source) {
    const image = new Image();
    image.src = source;
    await image.decode();
    return image;
  }

  async function prepare() {
    await Promise.all([loadSource('assets/fox-painting-data.js'), loadSource('assets/fox-grounded-data.js')]);
    const [original, patch] = await Promise.all([
      decode(globalThis.InkFoxPaintingSource), decode(globalThis.InkFoxGroundedSource)
    ]);
    const body = removePaper(original);
    const raised = splitForeleg(body, 1, true);
    const planted = splitForeleg(removePaper(original, patch), 0, false);
    painting = surface(body.width, body.height);
    const still = painting.getContext('2d');
    still.drawImage(planted, 0, 0);
    still.drawImage(body, 0, 0);
    shadow = makeShadow();
    try {
      puppet = createPuppet(body, planted, raised);
    } catch (error) {
      console.warn('插画形变不可用，显示定姿插画', error);
    }
    return Boolean(puppet);
  }

  function render(ctx, world, groundAt, scale) {
    const x = world.fox.x;
    const y = groundAt(x);
    const width = imageWidth * scale;
    const height = width * painting.height / painting.width;
    const slope = (groundAt(x + width * .16) - groundAt(x - width * .32)) / (width * .48);
    const animated = puppet?.draw(world, slope);
    ctx.save();
    ctx.translate(x, y);
    const alpha = ctx.globalAlpha;
    for (let i = 0; i < feet.length; i++) {
      const [u, v, size, opacity] = feet[i];
      const footX = (u - originX) * width;
      const footY = (v - originY) * height + slope * footX;
      const planted = i === feet.length - 1 && animated ? 1 - ease(world.fox.paw * 2.5) : 1;
      ctx.globalAlpha = alpha * opacity * planted;
      ctx.drawImage(shadow, footX - width * size * .5, footY - height * .009,
        width * size, height * .032);
    }
    ctx.globalAlpha = alpha;
    if (animated) {
      ctx.drawImage(puppet.canvas, -(originX + padX) * width, -(originY + padY) * height,
        width * (1 + 2 * padX), height * (1 + 2 * padY));
    } else {
      ctx.transform(1, slope, 0, 1, 0, 0);
      ctx.drawImage(painting, -originX * width, -originY * height, width, height);
    }
    ctx.restore();
  }

  globalThis.InkPaintedFox = { prepare, render };
})();
