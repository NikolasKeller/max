"use strict";

const ROLE_GK = "GK";
const ROLE_DEF = "DEF";
const ROLE_MID = "MID";
const ROLE_ATT = "ATT";

// Formations-Slots (Raute): fx = Abstand von der eigenen Torlinie (0..1),
// fy = seitlicher Versatz (-1..1)
const FORMATION = [
  { role: ROLE_GK, fx: 0.045, fy: 0, number: 1 },
  { role: ROLE_DEF, fx: 0.2, fy: -0.52, number: 4 },
  { role: ROLE_DEF, fx: 0.2, fy: 0.52, number: 5 },
  { role: ROLE_MID, fx: 0.42, fy: 0, number: 8 },
  { role: ROLE_ATT, fx: 0.62, fy: 0.18, number: 9 },
];

class Player {
  constructor(team, slot) {
    this.team = team;
    this.role = slot.role;
    this.slot = slot;
    this.number = slot.number;
    this.r = 13;
    this.baseSpeed = this.role === ROLE_GK ? 250 : 255;
    this.pos = { x: CENTER.x, y: CENTER.y };
    this.vel = { x: 0, y: 0 };
    this.facing = { x: attackDir(team), y: 0 };
    this.kickCooldown = 0; // kann Ball kurz nach Schuss/Pass nicht kontrollieren
    this.decideTimer = 0; // KI-Reaktionstakt
    this.aiMove = { x: 0, y: 0 };
    this.holdTimer = 0; // Torwart: wie lange er den Ball noch hält
    this.charge = -1; // Schuss-Ladung des Menschen (-1 = lädt nicht)
  }

  // Grundposition im Feld, abhängig von Ballposition (Team schiebt mit)
  homePos(ball) {
    const d = attackDir(this.team);
    const fw = FIELD.right - FIELD.left;
    const fh = FIELD.bottom - FIELD.top;
    const gx = ownGoalX(this.team);
    const isGK = this.role === ROLE_GK;
    const ballShiftX = (ball.pos.x - CENTER.x) * (isGK ? 0.03 : 0.34);
    const ballShiftY = (ball.pos.y - CENTER.y) * (isGK ? 0 : 0.28);
    let x = gx + d * this.slot.fx * fw + ballShiftX;
    let y = CENTER.y + this.slot.fy * (fh / 2) * 0.8 + ballShiftY;
    x = clamp(x, FIELD.left + 25, FIELD.right - 25);
    y = clamp(y, FIELD.top + 25, FIELD.bottom - 25);
    return { x, y };
  }

  // Anstoß-Aufstellung: alle in der eigenen Hälfte
  kickoffPos(hasKickoff) {
    const d = attackDir(this.team);
    const fw = FIELD.right - FIELD.left;
    const fh = FIELD.bottom - FIELD.top;
    const gx = ownGoalX(this.team);
    if (this.role === ROLE_ATT && hasKickoff) {
      return { x: CENTER.x - d * 26, y: CENTER.y + 18 };
    }
    let fx = Math.min(this.slot.fx, 0.38);
    let x = gx + d * fx * fw;
    let y = CENTER.y + this.slot.fy * (fh / 2) * 0.75;
    return { x, y };
  }

  update(dt, desiredDir, speedMul) {
    const target = {
      x: desiredDir.x * this.baseSpeed * speedMul,
      y: desiredDir.y * this.baseSpeed * speedMul,
    };
    // exponentielles Angleichen an die Zielgeschwindigkeit → responsives Gefühl
    const k = 1 - Math.exp(-9 * dt);
    this.vel.x += (target.x - this.vel.x) * k;
    this.vel.y += (target.y - this.vel.y) * k;
    this.pos.x += this.vel.x * dt;
    this.pos.y += this.vel.y * dt;

    if (vlen(this.vel.x, this.vel.y) > 25) {
      const n = vnorm(this.vel.x, this.vel.y);
      this.facing.x = n.x;
      this.facing.y = n.y;
    }

    this.pos.x = clamp(this.pos.x, FIELD.left + this.r, FIELD.right - this.r);
    this.pos.y = clamp(this.pos.y, FIELD.top + this.r, FIELD.bottom - this.r);

    if (this.kickCooldown > 0) this.kickCooldown -= dt;
    if (this.decideTimer > 0) this.decideTimer -= dt;
  }

  // Reichweite, in der der Spieler den Ball führen/schießen kann
  controlRange(ball) {
    return this.r + ball.r + 9;
  }
}
