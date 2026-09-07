"use strict";

class Ball {
  constructor() {
    this.r = 8;
    this.reset();
  }

  reset() {
    this.pos = { x: CENTER.x, y: CENTER.y };
    this.vel = { x: 0, y: 0 };
    this.rot = 0;
    this.heldBy = null; // Torwart, der den Ball gefangen hat
  }

  speed() {
    return vlen(this.vel.x, this.vel.y);
  }

  update(dt) {
    if (this.heldBy) {
      // Ball klebt vor dem Torwart
      const gk = this.heldBy;
      this.pos.x = gk.pos.x + gk.facing.x * (gk.r + this.r - 2);
      this.pos.y = gk.pos.y + gk.facing.y * (gk.r + this.r - 2);
      this.vel.x = 0;
      this.vel.y = 0;
      return;
    }
    // Rollreibung: pro Sekunde bleibt nur ein Bruchteil der Geschwindigkeit
    const f = Math.pow(0.42, dt);
    this.vel.x *= f;
    this.vel.y *= f;
    const sp = this.speed();
    if (sp < 4) {
      this.vel.x = 0;
      this.vel.y = 0;
    }
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;
    this.rot += (sp / (2 * Math.PI * this.r)) * 2 * Math.PI * dt * 0.6;
  }

  kick(dirX, dirY, power) {
    this.heldBy = null;
    const d = vnorm(dirX, dirY);
    this.vel.x = d.x * power;
    this.vel.y = d.y * power;
  }
}
