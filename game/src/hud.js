// The HUD: DOM panels for health, money, wanted stars, the clock and
// the objective, a speedometer in cars, subtitles, and a live 2D
// minimap on a canvas showing streets, the player, cars, cops and the
// mission marker. Pure DOM/canvas, no extra files.

import { CITY_X, CITY_Z } from './config.js';

export function createHud() {
  const el = (id) => document.getElementById(id);
  const healthFill = el('health-fill');
  const healthText = el('health-text');
  const starsEl = el('stars');
  const moneyEl = el('money');
  const clockEl = el('clock');
  const objectiveEl = el('objective-text');
  const objectiveDist = el('objective-dist');
  const speedEl = el('speed');
  const subtitleEl = el('subtitle');
  const hintEl = el('hint');
  const crosshair = el('crosshair');
  const map = el('minimap');
  const mapCtx = map.getContext('2d');

  const MAP_W = 220;
  const MAP_H = 220;

  function drawMinimap(state) {
    const c = mapCtx;
    c.clearRect(0, 0, MAP_W, MAP_H);
    c.fillStyle = 'rgba(10, 16, 28, 0.85)';
    c.fillRect(0, 0, MAP_W, MAP_H);
    const sx = MAP_W / (CITY_X * 2 + 80);
    const sz = MAP_H / (CITY_Z * 2 + 80);
    const toMap = (x, z) => [(x + CITY_X + 40) * sx, (z + CITY_Z + 40) * sz];
    // Ocean on the east.
    const [seaX] = toMap(240, 0);
    c.fillStyle = '#1e7fa8';
    c.fillRect(seaX, 0, MAP_W - seaX, MAP_H);
    // Roads.
    c.strokeStyle = '#5a6270';
    c.lineWidth = 3;
    for (const rx of state.roadsX) {
      const [x1, y1] = toMap(rx, -CITY_Z);
      const [x2, y2] = toMap(rx, CITY_Z);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    for (const rz of state.roadsZ) {
      const [x1, y1] = toMap(-CITY_X, rz);
      const [x2, y2] = toMap(CITY_X, rz);
      c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    }
    // Mission marker.
    if (state.marker) {
      const [mx, my] = toMap(state.marker.x, state.marker.z);
      c.fillStyle = '#ffd23e';
      c.beginPath();
      c.arc(mx, my, 6, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#141414';
      c.lineWidth = 2;
      c.stroke();
    }
    // Traffic dots.
    c.fillStyle = '#e8e8e8';
    for (const car of state.traffic) {
      const [cx, cy] = toMap(car.x, car.z);
      c.fillRect(cx - 1.5, cy - 1.5, 3, 3);
    }
    // Police, flashing blue/red.
    c.fillStyle = Math.floor(state.time * 2) % 2 === 0 ? '#3b82f6' : '#ef4444';
    for (const cop of state.police) {
      const [cx, cy] = toMap(cop.x, cop.z);
      c.beginPath();
      c.arc(cx, cy, 3.5, 0, Math.PI * 2);
      c.fill();
    }
    // Player arrow.
    const [px, py] = toMap(state.player.x, state.player.z);
    c.save();
    c.translate(px, py);
    c.rotate(-state.player.heading);
    c.fillStyle = '#ff5a3c';
    c.beginPath();
    c.moveTo(8, 0);
    c.lineTo(-5, -5);
    c.lineTo(-5, 5);
    c.closePath();
    c.fill();
    c.restore();
    // North tick.
    c.fillStyle = '#ffffff';
    c.font = 'bold 11px system-ui, sans-serif';
    c.fillText('N', 8, 14);
  }

  return {
    update(state) {
      const hp = Math.max(0, Math.round(state.health));
      healthFill.style.width = hp + '%';
      healthFill.style.background = hp > 50 ? '#37b24d' : hp > 25 ? '#f2c230' : '#e5534b';
      healthText.textContent = hp;
      let stars = '';
      for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
      starsEl.textContent = stars;
      starsEl.style.color = state.wanted > 0 ? '#ffd23e' : '#8b93a3';
      moneyEl.textContent = '$' + Math.floor(state.money).toLocaleString('en-US');
      clockEl.textContent = state.clock;
      objectiveEl.textContent = state.objective;
      objectiveDist.textContent = state.objectiveDist || '';
      if (state.inCar) {
        speedEl.style.display = 'block';
        speedEl.textContent = Math.round(Math.abs(state.speed) * 3.6) + ' km/h';
      } else {
        speedEl.style.display = 'none';
      }
      if (state.subtitle) {
        subtitleEl.style.display = 'block';
        subtitleEl.innerHTML = '<b>' + state.subtitle.speaker + ':</b> ' + state.subtitle.text;
      } else {
        subtitleEl.style.display = 'none';
      }
      if (state.hint) {
        hintEl.style.display = 'block';
        hintEl.textContent = state.hint;
      } else {
        hintEl.style.display = 'none';
      }
      crosshair.style.display = state.pistolEquipped ? 'block' : 'none';
      drawMinimap(state);
    },
  };
}
