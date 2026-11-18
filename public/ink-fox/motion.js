(function () {
  'use strict';

  const MIN_X = 410;
  const MAX_X = 1200;
  const FOX_SCALE = 1.52;
  const STRIDE = 57;
  const ACCELERATION = 142;
  const PI = Math.PI;
  const clamp = (value, min = 0, max = 1) => Math.max(min, Math.min(max, value));
  const lerp = (a, b, t) => a + (b - a) * t;
  const ease = t => {
    t = clamp(t);
    return t * t * (3 - 2 * t);
  };
  const damp = (value, target, rate, delta) => lerp(value, target, 1 - Math.exp(-rate * delta));

  function randomFrom(seed) {
    return () => {
      seed = (seed + 0x6D2B79F5) >>> 0;
      let v = seed;
      v = Math.imul(v ^ (v >>> 15), v | 1);
      v ^= v + Math.imul(v ^ (v >>> 7), v | 61);
      return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
    };
  }

  function range(random, from, to) {
    return lerp(from, to, random());
  }

  function createWorld(seed = Math.floor(Math.random() * 4294967296), { planted = false } = {}) {
    const random = randomFrom(seed >>> 0);
    const climate = randomFrom((seed ^ 0xA78E13D5) >>> 0);
    const ambient = { wind: range(climate, -.19, .46), mist: range(climate, .26, .68), light: range(climate, .33, .64) };
    const world = {
      seed, random, climate, planted, time: 0,
      weather: { ...ambient, gust: 0, drift: range(climate, -180, 180) },
      weatherFrom: ambient, weatherTo: null, weatherStart: 0, weatherLength: 1,
      gustAt: range(climate, 4, 9), gustLength: range(climate, 3.2, 5.5), gustDirection: climate() < .28 ? -1 : 1,
      blinkAt: range(random, 1.4, 4.0),
      state: 'listen', actionAge: 0, actionLength: range(random, .72, 1.8),
      plannedWalk: null, attention: null,
      fox: {
        x: range(random, 640, 1000), speed: 0, facing: random() < .54 ? -1 : 1,
        phase: range(random, 0, 1), pace: 0, look: 0, sniff: 0, ear: 0,
        blink: 0, tail: 0, paw: 0, turnWidth: 1, destination: 800, cruise: 62
      }
    };
    if (planted) world.fox.facing = 1;
    nextWeather(world, ambient);
    return world;
  }

  function nextWeather(world, from) {
    const random = world.climate;
    world.weatherFrom = from;
    world.weatherTo = {
      wind: range(random, -.31, .52),
      mist: from.mist > .48 ? range(random, .16, .40) : range(random, .54, .85),
      light: range(random, .26, .78)
    };
    world.weatherStart = world.time;
    world.weatherLength = range(random, 18, 36);
  }

  function stepWeather(world, delta) {
    const weather = world.weather;
    if (world.time >= world.weatherStart + world.weatherLength) {
      nextWeather(world, world.weatherTo);
    }
    const t = ease((world.time - world.weatherStart) / world.weatherLength);
    const baseWind = lerp(world.weatherFrom.wind, world.weatherTo.wind, t);
    weather.mist = lerp(world.weatherFrom.mist, world.weatherTo.mist, t);
    weather.light = lerp(world.weatherFrom.light, world.weatherTo.light, t);
    if (world.time >= world.gustAt + world.gustLength) {
      world.gustAt = world.time + range(world.climate, 4.6, 13);
      world.gustLength = range(world.climate, 3.2, 5.5);
      world.gustDirection = world.climate() < .33 ? -1 : 1;
    }
    const wave = Math.sin(PI * clamp((world.time - world.gustAt) / world.gustLength));
    weather.gust = wave * wave;
    weather.wind = baseWind + world.gustDirection * weather.gust * .57;
    weather.drift += (6.5 + weather.wind * 14) * delta;
  }

  function enter(world, action, length) {
    world.state = action;
    world.actionAge = 0;
    world.actionLength = length;
  }

  function startWalk(world, travel) {
    const fox = world.fox;
    fox.facing = travel.direction;
    fox.cruise = travel.cruise;
    fox.destination = travel.destination;
    fox.turnWidth = 1;
    enter(world, 'walk', Infinity);
  }

  function planWalk(world) {
    const fox = world.fox;
    const random = world.random;
    let direction = random() < .74 ? fox.facing : -fox.facing;
    if (fox.x < MIN_X + 105) direction = 1;
    if (fox.x > MAX_X - 105) direction = -1;
    const travel = {
      direction,
      cruise: range(random, 52, 84),
      destination: clamp(fox.x + direction * range(random, 116, 258), MIN_X, MAX_X)
    };
    if (direction !== fox.facing) {
      world.plannedWalk = travel;
      enter(world, 'turn', range(random, .74, 1.03));
      return;
    }
    startWalk(world, travel);
  }

  function stop(world) {
    const fox = world.fox;
    fox.speed = 0;
    if (world.attention && world.attention.expires > world.time) {
      const duration = world.planted ? range(world.random, 2.85, 3.45)
        : range(world.random, 1.6, 2.6);
      enter(world, 'look', duration);
      world.attention = null;
      return;
    }
    const next = world.random();
    if (world.planted) {
      if (next < .68) enter(world, 'listen', range(world.random, 3.7, 8.2));
      else if (next < .88) enter(world, 'sniff', range(world.random, 1.75, 2.7));
      else enter(world, 'look', range(world.random, 2.4, 3.3));
      return;
    }
    if (next < .40) enter(world, 'listen', range(world.random, 1.8, 4.2));
    else if (next < .81) enter(world, 'look', range(world.random, 1.65, 3.0));
    else enter(world, 'sniff', range(world.random, 1.6, 2.75));
  }

  function stepAction(world, delta) {
    const fox = world.fox;
    world.actionAge += delta;
    if (world.state === 'walk') {
      const remaining = Math.abs(fox.destination - fox.x);
      const target = Math.min(fox.cruise, Math.sqrt(2 * ACCELERATION * remaining));
      fox.speed += clamp(target - fox.speed, -ACCELERATION * delta, ACCELERATION * delta);
      const distance = Math.min(remaining, fox.speed * delta);
      fox.x += fox.facing * distance;
      fox.phase += distance / (STRIDE * FOX_SCALE);
      if (remaining <= distance + 1e-7) stop(world);
      return;
    }

    if (world.state === 'turn') {
      const pivot = clamp(world.actionAge / world.actionLength);
      fox.turnWidth = 1 - .48 * Math.sin(PI * pivot) ** 2;
      if (pivot >= .50) fox.facing = world.plannedWalk.direction;
      if (pivot === 1) {
        const travel = world.plannedWalk;
        world.plannedWalk = null;
        if (world.attention && world.attention.expires > world.time) {
          fox.turnWidth = 1;
          stop(world);
        } else {
          startWalk(world, travel);
        }
      }
      return;
    }

    if (world.actionAge >= world.actionLength) {
      if (world.planted) stop(world);
      else planWalk(world);
    }
  }

  function advance(world, delta) {
    delta = Number.isFinite(delta) ? clamp(delta, 0, .05) : 0;
    if (delta === 0) return world;
    world.time += delta;
    stepWeather(world, delta);
    stepAction(world, delta);

    const fox = world.fox;
    const age = world.actionAge;
    const remaining = world.actionLength - age;
    const envelope = ease(age / .42) * ease(remaining / .49);
    const turn = world.state === 'turn' ? Math.sin(PI * clamp(age / world.actionLength)) ** 2 : 0;
    const looking = world.state === 'look';
    const alert = world.planted && looking;
    const look = alert ? ease((age - .13) / .60) * ease(remaining / .79) : envelope;
    fox.look = damp(fox.look, looking ? look : .62 * turn, 11, delta);
    fox.sniff = damp(fox.sniff, world.state === 'sniff' ? envelope : 0, 10, delta);
    fox.pace = damp(fox.pace, clamp(fox.speed / Math.max(fox.cruise * .82, 1)), 11, delta);
    const paw = alert ? ease((age - .33) / .72) * ease(remaining / .84) : 0;
    fox.paw = damp(fox.paw, paw, 9.2, delta);

    const listening = world.state === 'listen';
    const stillEar = .42 * Math.exp(-(((age - .62) / .18) ** 2));
    const idleEar = listening ? (world.planted ? stillEar : Math.sin(age * 4.8) ** 6 * envelope) : 0;
    const perk = alert ? .91 * Math.exp(-(((age - .18) / .15) ** 2)) : 0;
    const gustElapsed = world.time - world.gustAt - .49;
    const windEar = Math.sin(PI * clamp(gustElapsed / .56)) ** 2;
    fox.ear = damp(fox.ear, clamp(idleEar * .75 + perk + windEar * .80 + fox.look * .31), 18, delta);
    const tailBase = Math.sin(world.time * 1.56 + world.seed % 45) * .37;
    const tail = world.planted
      ? .23 * Math.sin(world.time * 1.28 + world.seed % 45) + .10 * Math.sin(world.time * .49 + world.seed % 21)
        + world.weather.wind * .59 + fox.look * .22 - fox.sniff * .11
      : tailBase + world.weather.wind * .40 - fox.pace * .30 + fox.look * .26;
    fox.tail = damp(fox.tail, tail, 3.3, delta);

    const blinkTime = world.time - world.blinkAt;
    fox.blink = blinkTime >= 0 && blinkTime < .151 ? Math.sin(PI * blinkTime / .151) ** .8 : 0;
    if (blinkTime >= .151) world.blinkAt = world.time + range(world.random, 2.3, 6.0);
    return world;
  }

  function attend(world, at) {
    if (!Number.isFinite(at)) return;
    const fox = world.fox;
    if (world.planted && world.state === 'look') {
      world.actionLength = Math.max(world.actionLength, world.actionAge + 2.1);
      return;
    }
    world.attention = { x: at, expires: world.time + 4.2 };
    if (world.state === 'walk') {
      const stoppingDistance = Math.max(12, fox.speed * fox.speed / (2 * ACCELERATION));
      const left = Math.abs(fox.destination - fox.x);
      fox.destination = clamp(fox.x + fox.facing * Math.min(left, stoppingDistance), MIN_X, MAX_X);
    } else if (world.state !== 'turn') {
      stop(world);
    }
  }

  function footCycle(phase, blend) {
    const support = .63;
    const halfStep = STRIDE * support / 2;
    const t = phase - Math.floor(phase);
    if (t <= support) {
      return { x: blend * (halfStep - t * STRIDE), y: 0 };
    }
    const swing = (t - support) / (1 - support);
    const lift = Math.sin(PI * swing) ** 1.45;
    return { x: blend * lerp(-halfStep, halfStep, ease(swing)), y: blend ? -14 * lift * blend : 0 };
  }

  const api = { createWorld, advance, attend, footCycle, randomFrom, STRIDE, FOX_SCALE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else globalThis.InkFoxMotion = api;
})();
