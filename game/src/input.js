// Keyboard and mouse input. Held keys are read every frame; one-shot
// presses (interact, pause, weapon switch, horn) are queued as flags and
// taken once by the loop, so a press between two frames is never lost or
// counted twice. The camera orbits while the mouse is dragged.

export const ACT_INTERACT = 1;
export const ACT_PAUSE = 2;
export const ACT_WEAPON = 4;
export const ACT_HORN = 8;
export const ACT_ATTACK = 16;

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'KeyE') actions |= ACT_INTERACT;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACT_PAUSE;
    else if (event.code === 'KeyQ' || event.code === 'Digit2') actions |= ACT_WEAPON;
    else if (event.code === 'KeyH') actions |= ACT_HORN;
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.code)) event.preventDefault();
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    if (event.button === 0) actions |= ACT_ATTACK;
  });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', (event) => {
    if (!dragging) return;
    mouseDX += event.clientX - lastX;
    mouseDY += event.clientY - lastY;
    lastX = event.clientX;
    lastY = event.clientY;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    held(code) { return keys.has(code); },
    // -1/0/1 for the A/D or arrow keys.
    strafe() { return (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0); },
    // -1/0/1 for the W/S or arrow keys.
    forward() { return (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0); },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    takeActions() { const taken = actions; actions = 0; return taken; },
    // Mouse drag since the last call, in pixels; consumed by the camera.
    takeMouse() { const dx = mouseDX; const dy = mouseDY; mouseDX = 0; mouseDY = 0; return { dx, dy }; },
  };
}
