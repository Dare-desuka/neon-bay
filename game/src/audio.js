// All sound is synthesized with WebAudio: no audio files, no network.
// Engine hum, a two-tone siren, gunfire, punches, pickup blips and a
// looping bass-and-hats groove. Audio starts only after a user gesture
// (the start button), and stays silent in screenshot mode.

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenHigh = false;
  let sirenTimer = 0;
  let musicTimer = null;
  let musicOn = false;
  let musicStep = 0;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      started = true;
      return true;
    } catch {
      return false;
    }
  }

  function blip(freq, dur, type, vol, when = 0) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime + when;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(vol, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    } catch {
      // audio is decoration: never break the game
    }
  }

  function noiseBurst(dur, vol, freq) {
    if (!ctx) return;
    try {
      const t = ctx.currentTime;
      const len = Math.floor(ctx.sampleRate * dur);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = freq;
      const gain = ctx.createGain();
      gain.gain.value = vol;
      src.connect(filter);
      filter.connect(gain);
      gain.connect(master);
      src.start(t);
    } catch {
      // ignore
    }
  }

  // A simple 8-step loop in A minor: bass notes with a kick and a hat.
  const BASS = [55, 0, 55, 65.41, 55, 0, 49, 58.27];
  function musicTick() {
    if (!ctx || !musicOn) return;
    const note = BASS[musicStep % BASS.length];
    if (note) blip(note * 2, 0.22, 'triangle', 0.16);
    if (musicStep % 2 === 0) noiseBurst(0.05, 0.12, 300); // hat
    if (musicStep % 4 === 0) blip(50, 0.12, 'sine', 0.25); // kick
    musicStep += 1;
  }

  return {
    /** Call from a user gesture (start button). Returns true when live. */
    start() {
      if (!ensure()) return false;
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      try {
        engineOsc = ctx.createOscillator();
        engineOsc2 = ctx.createOscillator();
        engineGain = ctx.createGain();
        engineOsc.type = 'sawtooth';
        engineOsc2.type = 'square';
        engineOsc.frequency.value = 50;
        engineOsc2.frequency.value = 25;
        engineGain.gain.value = 0;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 500;
        engineOsc.connect(filter);
        engineOsc2.connect(filter);
        filter.connect(engineGain);
        engineGain.connect(master);
        engineOsc.start();
        engineOsc2.start();
        sirenOsc = ctx.createOscillator();
        sirenGain = ctx.createGain();
        sirenOsc.type = 'sine';
        sirenOsc.frequency.value = 700;
        sirenGain.gain.value = 0;
        sirenOsc.connect(sirenGain);
        sirenGain.connect(master);
        sirenOsc.start();
      } catch {
        // ignore
      }
      if (!musicTimer) musicTimer = window.setInterval(musicTick, 300);
      musicOn = true;
      return true;
    },
    setEngine(speed01, inCar) {
      if (!ctx || !engineOsc) return;
      const target = inCar ? 0.05 + speed01 * 0.09 : 0;
      engineGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(45 + speed01 * 140, ctx.currentTime, 0.1);
      engineOsc2.frequency.setTargetAtTime(22 + speed01 * 70, ctx.currentTime, 0.1);
    },
    setSiren(on, dt) {
      if (!ctx || !sirenOsc) return;
      sirenGain.gain.setTargetAtTime(on ? 0.045 : 0, ctx.currentTime, 0.2);
      if (!on) return;
      sirenTimer += dt;
      if (sirenTimer > 0.45) {
        sirenTimer = 0;
        sirenHigh = !sirenHigh;
        sirenOsc.frequency.setTargetAtTime(sirenHigh ? 950 : 700, ctx.currentTime, 0.05);
      }
    },
    setMusic(on) { musicOn = on; },
    shoot() { noiseBurst(0.09, 0.5, 1800); blip(180, 0.06, 'square', 0.2); },
    punch() { blip(120, 0.12, 'sine', 0.4); noiseBurst(0.05, 0.2, 500); },
    pickup() { blip(660, 0.09, 'sine', 0.25); blip(990, 0.14, 'sine', 0.25, 0.09); },
    cash() { blip(880, 0.08, 'triangle', 0.25); blip(1174, 0.1, 'triangle', 0.25, 0.08); blip(1568, 0.16, 'triangle', 0.25, 0.16); },
    busted() { blip(220, 0.3, 'sawtooth', 0.25); blip(165, 0.5, 'sawtooth', 0.25, 0.28); },
    horn() { blip(370, 0.18, 'square', 0.12); blip(466, 0.18, 'square', 0.12); },
  };
}
