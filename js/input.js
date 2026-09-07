"use strict";

class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.justPressed = new Set();
    this.mouse = { x: 0, y: 0, clicked: false, down: false };

    window.addEventListener("keydown", (e) => {
      if (!this.keys.has(e.code)) this.justPressed.add(e.code);
      this.keys.add(e.code);
      if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) {
        e.preventDefault();
      }
      sfx.ensure();
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.keys.clear());

    canvas.addEventListener("mousemove", (e) => this._updateMouse(e));
    canvas.addEventListener("mousedown", (e) => {
      this._updateMouse(e);
      this.mouse.down = true;
      sfx.ensure();
    });
    canvas.addEventListener("mouseup", (e) => {
      this._updateMouse(e);
      if (this.mouse.down) this.mouse.clicked = true;
      this.mouse.down = false;
    });
  }

  // Mausposition von CSS-Pixeln in interne Canvas-Koordinaten umrechnen
  _updateMouse(e) {
    const r = this.canvas.getBoundingClientRect();
    this.mouse.x = ((e.clientX - r.left) / r.width) * W;
    this.mouse.y = ((e.clientY - r.top) / r.height) * H;
  }

  down(...codes) {
    return codes.some((c) => this.keys.has(c));
  }

  pressed(...codes) {
    return codes.some((c) => this.justPressed.has(c));
  }

  moveDir() {
    let x = 0;
    let y = 0;
    if (this.down("ArrowLeft", "KeyA")) x -= 1;
    if (this.down("ArrowRight", "KeyD")) x += 1;
    if (this.down("ArrowUp", "KeyW")) y -= 1;
    if (this.down("ArrowDown", "KeyS")) y += 1;
    return vnorm(x, y);
  }

  shootDown() {
    return this.down("Space");
  }

  passPressed() {
    return this.pressed("KeyE", "KeyX", "ShiftLeft", "ShiftRight");
  }

  pausePressed() {
    return this.pressed("KeyP", "Escape");
  }

  mutePressed() {
    return this.pressed("KeyM");
  }

  // Am Frame-Ende aufrufen: einmalige Events zurücksetzen
  endFrame() {
    this.justPressed.clear();
    this.mouse.clicked = false;
  }
}
