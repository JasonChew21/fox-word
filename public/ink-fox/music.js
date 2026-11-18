(function () {
  'use strict';

  const button = document.getElementById('music');
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  const variant = new URLSearchParams(location.search).get('fox') ?? 'painted';
  if (!AudioContext || variant !== 'painted') return;

  const cycle = 36.8;
  // An original, slow pentatonic melody in D, with room between the phrases.
  const plucks = [
    [0, 50, .25], [.47, 57, .16], [1.55, 62, .22], [3.13, 64, .15], [3.89, 66, .19],
    [5.76, 69, .16], [7.27, 66, .15], [9.19, 64, .18], [9.83, 62, .22],
    [12.22, 50, .24], [12.72, 57, .14], [14.15, 59, .16], [14.91, 62, .18],
    [16.36, 66, .18], [18.14, 64, .15], [19.19, 62, .21],
    [22.88, 54, .17], [23.59, 57, .15], [25.18, 59, .16], [26.29, 62, .19],
    [28.39, 64, .16], [30.12, 62, .20], [32.38, 50, .21]
  ];
  const flutes = [
    [4.47, 66, .072, 1.94], [7.12, 64, .061, 2.16],
    [15.5, 69, .064, 2.42], [18.4, 66, .065, 2.72],
    [25.63, 64, .069, 2.15], [28.68, 62, .062, 2.95]
  ];
  const score = [...plucks, ...flutes].sort((a, b) => a[0] - b[0]);
  const frequency = midi => 440 * 2 ** ((midi - 69) / 12);
  const floor = .0001;
  let player;
  let enabled = false;
  let revision = 0;

  function makePlayer() {
    const ctx = new AudioContext();
    const mix = ctx.createGain();
    const room = ctx.createConvolver();
    const wet = ctx.createGain();
    const master = ctx.createGain();
    const pluckPan = ctx.createStereoPanner();
    const flutePan = ctx.createStereoPanner();
    const random = globalThis.InkFoxMotion.randomFrom((Date.now() ^ 61371) >>> 0);

    master.gain.value = 0;
    wet.gain.value = .23;
    pluckPan.pan.value = -.21;
    flutePan.pan.value = .25;
    pluckPan.connect(mix);
    flutePan.connect(mix);
    mix.connect(master);
    mix.connect(room);
    room.connect(wet);
    wet.connect(master);
    master.connect(ctx.destination);

    const air = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 3.65), ctx.sampleRate);
    const noise = air.getChannelData(0);
    for (let i = 0; i < noise.length; i++) noise[i] = random() * 2 - 1;

    const response = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * 2.18), ctx.sampleRate);
    for (let channel = 0; channel < response.numberOfChannels; channel++) {
      const data = response.getChannelData(channel);
      let previous = 0;
      const onset = Math.floor(ctx.sampleRate * (.029 + .011 * channel));
      for (let i = onset; i < data.length; i++) {
        previous += (random() * 2 - 1 - previous) * .32;
        const seconds = (i - onset) / ctx.sampleRate;
        data[i] = previous * Math.exp(-seconds * 3.7) * Math.min(1, seconds * 70);
      }
    }
    room.buffer = response;

    function wave(harmonics) {
      return ctx.createPeriodicWave(new Float32Array(harmonics.length), new Float32Array(harmonics));
    }

    const stringWave = wave([0, .83, .47, .28, .14, .107, .071, .052, .038, .019, .012]);
    const bambooWave = wave([0, 1, .16, .092, .037, .024, .009]);

    function breath(at, duration, level, color, output) {
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      source.buffer = air;
      filter.type = 'bandpass';
      filter.frequency.value = color;
      filter.Q.value = .78;
      envelope.gain.setValueAtTime(floor, at);
      envelope.gain.linearRampToValueAtTime(level, at + Math.min(.21, duration * .16));
      envelope.gain.exponentialRampToValueAtTime(floor, at + duration);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(output);
      source.onended = () => {
        source.disconnect();
        filter.disconnect();
        envelope.disconnect();
      };
      source.start(at, random() * .21, duration);
    }

    function qin(at, hz, volume) {
      const string = ctx.createOscillator();
      const tone = ctx.createBiquadFilter();
      const envelope = ctx.createGain();
      const decay = 2.15 + (1 - hz / 550) * .54;
      string.setPeriodicWave(stringWave);
      string.frequency.value = hz;
      string.detune.setValueAtTime(-9 + random() * 8, at);
      string.detune.linearRampToValueAtTime(0, at + .24);
      tone.type = 'lowpass';
      tone.frequency.setValueAtTime(Math.min(4600, hz * 15.2), at);
      tone.frequency.exponentialRampToValueAtTime(Math.max(540, hz * 3.2), at + .61);
      tone.Q.value = .17;
      envelope.gain.setValueAtTime(floor, at);
      envelope.gain.linearRampToValueAtTime(volume, at + .009);
      envelope.gain.exponentialRampToValueAtTime(volume * .31, at + .22);
      envelope.gain.exponentialRampToValueAtTime(volume * .10, at + .75);
      envelope.gain.exponentialRampToValueAtTime(floor, at + decay);
      string.connect(tone);
      tone.connect(envelope);
      envelope.connect(pluckPan);
      string.onended = () => {
        string.disconnect();
        tone.disconnect();
        envelope.disconnect();
      };
      breath(at, .077, volume * .094, 1850, pluckPan);
      string.start(at);
      string.stop(at + decay + .04);
    }

    function xiao(at, hz, volume, duration) {
      const bamboo = ctx.createOscillator();
      const vibrato = ctx.createOscillator();
      const depth = ctx.createGain();
      const envelope = ctx.createGain();
      bamboo.setPeriodicWave(bambooWave);
      bamboo.frequency.value = hz;
      bamboo.detune.setValueAtTime(-26 + random() * 10, at);
      bamboo.detune.linearRampToValueAtTime(0, at + .32);
      bamboo.detune.setTargetAtTime(-7, at + duration * .76, .17);
      vibrato.frequency.value = 4.35 + random() * .61;
      depth.gain.setValueAtTime(1.6, at);
      depth.gain.linearRampToValueAtTime(9, at + .82);
      vibrato.connect(depth);
      depth.connect(bamboo.detune);
      envelope.gain.setValueAtTime(floor, at);
      envelope.gain.linearRampToValueAtTime(volume, at + .31);
      envelope.gain.linearRampToValueAtTime(volume * .74, at + duration * .66);
      envelope.gain.exponentialRampToValueAtTime(floor, at + duration);
      bamboo.connect(envelope);
      envelope.connect(flutePan);
      bamboo.onended = () => {
        bamboo.disconnect();
        vibrato.disconnect();
        depth.disconnect();
        envelope.disconnect();
      };
      breath(at, duration, volume * .43, 1420, flutePan);
      bamboo.start(at);
      vibrato.start(at);
      bamboo.stop(at + duration + .03);
      vibrato.stop(at + duration + .03);
    }

    let origin;
    let cursor = 0;
    let ticking = null;
    let sleeping;

    function schedule() {
      const now = ctx.currentTime;
      origin ??= now + .11;
      if (now - origin > cycle) {
        origin += Math.floor((now - origin) / cycle) * cycle;
        cursor = 0;
      }
      while (origin + score[cursor][0] < now + .32) {
        const [beat, note, level, duration] = score[cursor];
        const at = origin + beat + (random() - .5) * .071;
        if (at > now - .04) {
          const start = Math.max(at, now + .007);
          const hz = frequency(note);
          const loudness = level * (.89 + random() * .22);
          if (duration) xiao(start, hz, loudness, duration);
          else qin(start, hz, loudness);
        }
        cursor++;
        if (cursor === score.length) {
          cursor = 0;
          origin += cycle;
        }
      }
    }

    function fade(target, speed) {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(target, ctx.currentTime, speed);
    }

    return {
      async start(current) {
        window.clearTimeout(sleeping);
        await ctx.resume();
        if (!current() || ticking !== null) return;
        fade(.66, .12);
        schedule();
        ticking = window.setInterval(schedule, 92);
      },
      pause() {
        window.clearInterval(ticking);
        ticking = null;
        fade(0, .044);
        window.clearTimeout(sleeping);
        sleeping = window.setTimeout(() => ctx.suspend().catch(() => {}), 245);
      }
    };
  }

  function showState() {
    button.setAttribute('aria-pressed', String(enabled));
    const label = enabled ? '关闭音乐' : '播放音乐';
    button.setAttribute('aria-label', label);
    button.title = label;
  }

  async function updatePlayback() {
    const request = ++revision;
    if (!enabled || document.hidden) {
      player?.pause();
      return;
    }
    try {
      player ??= makePlayer();
      await player.start(() => request === revision);
    } catch (error) {
      if (request !== revision) return;
      player?.pause();
      enabled = false;
      showState();
      button.title = '暂时无法播放音乐，点击重试';
      console.warn('古风配乐启动失败', error);
    }
  }

  button.hidden = false;
  button.addEventListener('click', () => {
    enabled = !enabled;
    showState();
    void updatePlayback();
  });
  document.addEventListener('visibilitychange', updatePlayback);
})();
