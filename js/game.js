"use strict";

const CONTROL_MAX_SPEED = 460; // schneller fliegende Bälle prallen ab statt kontrolliert zu werden

class Game {
  constructor() {
    this.settings = { difficulty: "mid", matchTime: 180 };
    this.difficulty = DIFFICULTIES[this.settings.difficulty];
    this.ball = new Ball();
    this.players = [];
    this.state = "menu";
    this.score = [0, 0];
    this.time = 0;
    this.goldenGoal = false;
    this.paused = false;
    this.controlled = null;
    this.chaser = [null, null];
    this.possession = null;
    this.ballCarrier = null;
    this.shootBuffer = 0; // gepufferte Schussladung nach zu frühem Loslassen
    this.shootBufferT = 0;
    this.kickoffTimer = 0;
    this.kickoffTeam = TEAM_BLUE;
    this.goalTimer = 0;
    this.goalTeam = 0;
    this.popups = [];
    this.particles = [];
    this.shake = 0;
    this.buttons = [];
    this.hoverButton = null;

    this.buildTeams();
    this.kickoffSetup(TEAM_BLUE);
  }

  buildTeams() {
    this.players = [];
    for (const team of [TEAM_BLUE, TEAM_RED]) {
      for (const slot of FORMATION) {
        this.players.push(new Player(team, slot));
      }
    }
  }

  fieldPlayers(team) {
    return this.players.filter((p) => p.team === team && p.role !== ROLE_GK);
  }

  goalkeeper(team) {
    return this.players.find((p) => p.team === team && p.role === ROLE_GK);
  }

  // ---------- Match-Ablauf ----------

  startMatch() {
    this.difficulty = DIFFICULTIES[this.settings.difficulty];
    this.score = [0, 0];
    this.time = this.settings.matchTime;
    this.goldenGoal = false;
    this.paused = false;
    this.kickoffSetup(TEAM_BLUE);
    this.state = "kickoff";
    sfx.startAmbient();
  }

  kickoffSetup(team) {
    this.kickoffTeam = team;
    this.kickoffTimer = 1.3;
    this.ball.reset();
    this.possession = null;
    this.ballCarrier = null;
    this.shootBufferT = 0;
    for (const p of this.players) {
      const pos = p.kickoffPos(p.team === team);
      p.pos = { x: pos.x, y: pos.y };
      p.vel = { x: 0, y: 0 };
      p.facing = { x: attackDir(p.team), y: 0 };
      p.kickCooldown = 0;
      p.charge = -1;
      p.holdTimer = 0;
    }
    this.controlled = null;
  }

  triggerGoal(team) {
    this.score[team]++;
    this.state = "goal";
    this.goalTeam = team;
    this.goalTimer = 2.4;
    this.shake = 11;
    sfx.whistleGoal();
    sfx.cheer();
    const gx = team === TEAM_BLUE ? FIELD.right : FIELD.left;
    this.spawnBurst(gx, CENTER.y, 130, ["#ffd166", "#fff", TEAM_INFO[team].color, "#7bffb0"]);
    const who = team === TEAM_BLUE ? "für DICH" : "für die CPU";
    this.addPopup("TOOOR!", { sub: `Treffer ${who}`, size: 92, color: "#ffd166", dur: 2.2 });
  }

  endMatch() {
    this.state = "fulltime";
    sfx.whistleFull();
    if (this.score[0] !== this.score[1]) sfx.cheer();
  }

  // ---------- Aktionen am Ball ----------

  doKick(p, dx, dy, power, kind) {
    this.ball.kick(dx, dy, power);
    p.kickCooldown = kind === "clear" ? 0.5 : 0.32;
    p.decideTimer = Math.max(p.decideTimer, 0.25);
    this.possession = null;
    this.ballCarrier = null;
    sfx.kick(power / 830);
    this.spawnBurst(this.ball.pos.x, this.ball.pos.y, 6, ["#e8ffe0"], 0.35, 60);
  }

  doPass(p, mate, aimErr) {
    const d = dist(p.pos, mate.pos);
    const power = clamp(d * 2.3, 350, 660);
    // Pass in den Lauf: Zielpunkt leicht vor den Mitspieler legen
    const t = d / power;
    const tx = mate.pos.x + mate.vel.x * t * 0.8;
    const ty = mate.pos.y + mate.vel.y * t * 0.8;
    let ang = Math.atan2(ty - p.pos.y, tx - p.pos.x);
    ang += gaussRand() * aimErr * 0.5;
    this.doKick(p, Math.cos(ang), Math.sin(ang), power, "pass");
  }

  humanShoot(p, charge) {
    let dir = { x: p.facing.x, y: p.facing.y };
    // Zielhilfe: aufs Tor ziehen, wenn man grob in dessen Richtung zielt.
    // Ziel-Y wird in die Toröffnung geklemmt, damit Schüsse nicht knapp vorbeigehen.
    const goal = attackGoalCenter(p.team);
    const targetY = clamp(
      p.pos.y + p.facing.y * 90,
      CENTER.y - GOAL_HALF + 14,
      CENTER.y + GOAL_HALF - 14
    );
    const toGoal = vnorm(goal.x - p.pos.x, targetY - p.pos.y);
    const dot = dir.x * toGoal.x + dir.y * toGoal.y;
    if (dot > 0.35) {
      dir = vnorm(lerp(dir.x, toGoal.x, 0.55), lerp(dir.y, toGoal.y, 0.55));
    }
    const power = 480 + charge * 430;
    this.doKick(p, dir.x, dir.y, power, "shot");
  }

  // ---------- Simulation ----------

  stepMatch(dt, isDemo) {
    const input = this.input;

    if (!isDemo) this.pickControlled();
    else this.controlled = null;

    this.computeChasers();

    // Bewegungsrichtungen bestimmen und Aktionen ausführen
    for (const p of this.players) {
      let dir;
      let speedMul = p.team === TEAM_RED ? this.difficulty.speed : MATE_SKILL.speed;
      if (p.role === ROLE_GK) {
        speedMul = p.team === TEAM_RED ? this.difficulty.gkSpeed : MATE_SKILL.gkSpeed;
      }

      if (!isDemo && p === this.controlled) {
        dir = input.moveDir();
        speedMul = 1.05; // kleiner Heldenbonus für den Menschen
        this.humanActions(p, dt, dir);
        if (p.charge >= 0) speedMul = 0.75; // beim Laden langsamer laufen
      } else {
        dir = AI.updatePlayer(this, p, dt);
      }
      p.update(dt, dir, speedMul);
    }

    this.collidePlayers();
    this.gkHandling();
    this.resolveBallControl();
    this.ball.update(dt);
    this.updateBallBounds(isDemo);
  }

  humanActions(p, dt, moveDir) {
    const input = this.input;
    const ball = this.ball;
    const inRange =
      dist(p.pos, ball.pos) < p.controlRange(ball) + 8 && p.kickCooldown <= 0 && !ball.heldBy;

    // Schuss: Leertaste halten = aufladen, loslassen = schießen
    if (input.shootDown()) {
      if (p.charge < 0) p.charge = 0;
      p.charge = Math.min(1, p.charge + dt / 0.55);
    } else if (p.charge >= 0) {
      if (inRange) {
        this.humanShoot(p, p.charge);
      } else {
        // zu früh losgelassen: Schuss kurz puffern und nachholen,
        // sobald der Ball in Reichweite kommt
        this.shootBuffer = p.charge;
        this.shootBufferT = 0.3;
      }
      p.charge = -1;
    }

    if (this.shootBufferT > 0) {
      this.shootBufferT -= dt;
      if (inRange) {
        this.humanShoot(p, this.shootBuffer);
        this.shootBufferT = 0;
      }
    }

    // Pass
    if (input.passPressed() && inRange) {
      const mate = this.bestHumanPassTarget(p, moveDir);
      if (mate) this.doPass(p, mate, 0.05);
    }
  }

  bestHumanPassTarget(p, moveDir) {
    const aim = vlen(moveDir.x, moveDir.y) > 0.1 ? moveDir : p.facing;
    let best = null;
    let bs = -Infinity;
    for (const m of this.players) {
      if (m.team !== p.team || m === p || m.role === ROLE_GK) continue;
      const d = dist(m.pos, p.pos);
      if (d < 40) continue;
      const dir = vnorm(m.pos.x - p.pos.x, m.pos.y - p.pos.y);
      const dot = dir.x * aim.x + dir.y * aim.y;
      const score = dot * 2 - d / 500;
      if (score > bs) {
        bs = score;
        best = m;
      }
    }
    return best;
  }

  pickControlled() {
    let best = null;
    let bs = Infinity;
    for (const p of this.fieldPlayers(TEAM_BLUE)) {
      let d = dist(p.pos, this.ball.pos);
      if (p === this.controlled) d *= 0.72; // Hysterese gegen Flackern
      if (d < bs) {
        bs = d;
        best = p;
      }
    }
    this.controlled = best;
  }

  computeChasers() {
    for (const team of [TEAM_BLUE, TEAM_RED]) {
      const oppHasBall =
        this.possession !== null && this.possession !== team;
      let best = null;
      let bs = Infinity;
      for (const p of this.fieldPlayers(team)) {
        // Beim Pressing gegen den Ballführer zählt der Mensch nicht mit:
        // der nächste KI-Mitspieler attackiert IMMER zusätzlich. So bricht
        // die Abwehr nicht zusammen, wenn der Mensch woanders steht.
        if (team === TEAM_BLUE && oppHasBall && p === this.controlled) continue;
        const d = dist(p.pos, this.ball.pos);
        if (d < bs) {
          bs = d;
          best = p;
        }
      }
      // Bei freiem Ball oder eigenem Ballbesitz hat der Mensch Vorrang,
      // solange er nicht deutlich weiter weg ist – sonst klauen ihm die
      // KI-Mitspieler ständig den Ball.
      if (team === TEAM_BLUE && !oppHasBall && this.controlled && best !== this.controlled) {
        const dc = dist(this.controlled.pos, this.ball.pos);
        if (dc < bs * 1.6) best = this.controlled;
      }
      this.chaser[team] = best;
    }
  }

  collidePlayers() {
    const ps = this.players;
    for (let i = 0; i < ps.length; i++) {
      for (let j = i + 1; j < ps.length; j++) {
        const a = ps[i];
        const b = ps[j];
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const d = Math.hypot(dx, dy);
        const min = a.r + b.r;
        if (d > 0.001 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d;
          const ny = dy / d;
          a.pos.x -= nx * push;
          a.pos.y -= ny * push;
          b.pos.x += nx * push;
          b.pos.y += ny * push;
        }
      }
    }
  }

  gkHandling() {
    const ball = this.ball;
    if (ball.heldBy) return;
    for (const team of [TEAM_BLUE, TEAM_RED]) {
      const gk = this.goalkeeper(team);
      const d = dist(gk.pos, ball.pos);
      if (d < gk.r + ball.r + 7 && gk.kickCooldown <= 0) {
        const sp = ball.speed();
        const catchMax = team === TEAM_RED ? this.difficulty.gkCatch : MATE_SKILL.gkCatch;
        // Ein Torwart in voller Bewegung kann nur abwehren, nicht festhalten
        const gkMoving = vlen(gk.vel.x, gk.vel.y) > 165;
        if (sp < catchMax && !gkMoving) {
          ball.heldBy = gk;
          gk.holdTimer = 0.9;
          this.possession = team;
          this.ballCarrier = null;
          sfx.catchBall();
          this.addPopup("Gehalten!", { size: 30, dur: 0.9, color: "#d5f7ff" });
        } else {
          // Parade: Ball prallt ab und bleibt im Spiel (Nachschuss-Chance!)
          this.reflectBallOffPlayer(gk, 0.42);
          // immer vom eigenen Tor weg klären, nie ins eigene Netz fumbeln
          const out = attackDir(team);
          if (ball.vel.x * out < 80) {
            ball.vel.x = out * Math.max(140, Math.abs(ball.vel.x));
            ball.vel.y += randRange(-60, 60);
          }
          gk.kickCooldown = 0.45;
          this.ballCarrier = null;
          sfx.catchBall();
          this.addPopup("Parade!", { size: 34, dur: 1.0, color: "#d5f7ff" });
        }
        return;
      }
    }
  }

  reflectBallOffPlayer(p, damp) {
    const ball = this.ball;
    const n = vnorm(ball.pos.x - p.pos.x, ball.pos.y - p.pos.y);
    const dot = ball.vel.x * n.x + ball.vel.y * n.y;
    if (dot < 0) {
      ball.vel.x -= 2 * dot * n.x;
      ball.vel.y -= 2 * dot * n.y;
    }
    ball.vel.x = ball.vel.x * damp + p.vel.x * 0.4;
    ball.vel.y = ball.vel.y * damp + p.vel.y * 0.4;
    const overlap = p.r + ball.r + 1 - dist(p.pos, ball.pos);
    if (overlap > 0) {
      ball.pos.x += n.x * overlap;
      ball.pos.y += n.y * overlap;
    }
  }

  resolveBallControl() {
    const ball = this.ball;
    if (ball.heldBy) return;
    const sp = ball.speed();

    // Schnelle Bälle prallen an Spielern ab (Blocks, Abfälschungen)
    if (sp >= CONTROL_MAX_SPEED) {
      for (const p of this.players) {
        if (dist(p.pos, ball.pos) < p.r + ball.r) {
          this.reflectBallOffPlayer(p, 0.5);
          this.possession = null;
          this.ballCarrier = null;
          sfx.bounce();
          return;
        }
      }
      return;
    }

    // Langsame Bälle: der nächste Spieler in Reichweite führt den Ball
    let controller = null;
    let bd = Infinity;
    for (const p of this.players) {
      if (p.kickCooldown > 0 || p.role === ROLE_GK) continue;
      const d = dist(p.pos, ball.pos);
      if (d < p.controlRange(ball) && d < bd) {
        bd = d;
        controller = p;
      }
    }
    // Ballbesitz des Menschen ist "klebrig": Er behält den Ball beim Dribbeln,
    // solange der Herausforderer nicht deutlich näher am Ball ist (Abschirmen).
    // Nur für den gesteuerten Spieler, damit KI-Duelle fair bleiben.
    const carrier = this.ballCarrier;
    if (
      controller &&
      carrier &&
      carrier === this.controlled &&
      controller !== carrier &&
      carrier.kickCooldown <= 0 &&
      dist(carrier.pos, ball.pos) < carrier.controlRange(ball) &&
      bd > dist(carrier.pos, ball.pos) * 0.7
    ) {
      controller = carrier;
    }
    if (!controller) {
      this.ballCarrier = null;
      return;
    }

    this.possession = controller.team;
    this.ballCarrier = controller;
    // Ball vor den Fuß legen: Zielpunkt in Blickrichtung
    const lead = controller.r + ball.r + 4;
    const tx = controller.pos.x + controller.facing.x * lead;
    const ty = controller.pos.y + controller.facing.y * lead;
    const pull = 9;
    let vx = controller.vel.x + (tx - ball.pos.x) * pull;
    let vy = controller.vel.y + (ty - ball.pos.y) * pull;
    const maxDribble = controller.baseSpeed * 1.45 + 70;
    const vl = vlen(vx, vy);
    if (vl > maxDribble) {
      vx = (vx / vl) * maxDribble;
      vy = (vy / vl) * maxDribble;
    }
    ball.vel.x = vx;
    ball.vel.y = vy;
  }

  updateBallBounds(isDemo) {
    const ball = this.ball;
    if (ball.heldBy) return;
    const r = ball.r;
    const cy = CENTER.y;
    let bounced = false;

    if (ball.pos.y < FIELD.top + r) {
      ball.pos.y = FIELD.top + r;
      ball.vel.y = -ball.vel.y * 0.72;
      bounced = true;
    }
    if (ball.pos.y > FIELD.bottom - r) {
      ball.pos.y = FIELD.bottom - r;
      ball.vel.y = -ball.vel.y * 0.72;
      bounced = true;
    }

    const inMouth = Math.abs(ball.pos.y - cy) < GOAL_HALF;

    // Pfosten-Kollisionen
    for (const gx of [FIELD.left, FIELD.right]) {
      for (const gy of [cy - GOAL_HALF, cy + GOAL_HALF]) {
        const d = Math.hypot(ball.pos.x - gx, ball.pos.y - gy);
        if (d < r + POST_R && d > 0.001) {
          const nx = (ball.pos.x - gx) / d;
          const ny = (ball.pos.y - gy) / d;
          const dot = ball.vel.x * nx + ball.vel.y * ny;
          if (dot < 0) {
            ball.vel.x -= 2 * dot * nx;
            ball.vel.y -= 2 * dot * ny;
            ball.vel.x *= 0.7;
            ball.vel.y *= 0.7;
            if (ball.speed() > 150) {
              sfx.post();
              if (!isDemo) this.addPopup("Pfosten!", { size: 34, dur: 1.0, color: "#ffe9a8" });
            }
          }
          ball.pos.x = gx + nx * (r + POST_R);
          ball.pos.y = gy + ny * (r + POST_R);
        }
      }
    }

    // Linkes Ende: Toröffnung oder Bande
    if (ball.pos.x < FIELD.left + r) {
      if (inMouth) {
        if (this.state === "play" || this.state === "kickoff" || isDemo) {
          if (ball.pos.x + r < FIELD.left) {
            if (isDemo) this.demoGoalReset();
            else this.triggerGoal(TEAM_RED);
          }
        }
        // Netz-Rückwand
        if (ball.pos.x < FIELD.left - GOAL_DEPTH + r) {
          ball.pos.x = FIELD.left - GOAL_DEPTH + r;
          ball.vel.x = -ball.vel.x * 0.25;
          ball.vel.y *= 0.4;
        }
      } else {
        ball.pos.x = FIELD.left + r;
        ball.vel.x = -ball.vel.x * 0.72;
        bounced = true;
      }
    }

    // Rechtes Ende
    if (ball.pos.x > FIELD.right - r) {
      if (inMouth) {
        if (this.state === "play" || this.state === "kickoff" || isDemo) {
          if (ball.pos.x - r > FIELD.right) {
            if (isDemo) this.demoGoalReset();
            else this.triggerGoal(TEAM_BLUE);
          }
        }
        if (ball.pos.x > FIELD.right + GOAL_DEPTH - r) {
          ball.pos.x = FIELD.right + GOAL_DEPTH - r;
          ball.vel.x = -ball.vel.x * 0.25;
          ball.vel.y *= 0.4;
        }
      } else {
        ball.pos.x = FIELD.right - r;
        ball.vel.x = -ball.vel.x * 0.72;
        bounced = true;
      }
    }

    if (bounced && ball.speed() > 130) sfx.bounce();
  }

  demoGoalReset() {
    this.kickoffSetup(Math.random() < 0.5 ? TEAM_BLUE : TEAM_RED);
    this.kickoffTimer = 0;
  }

  // ---------- Haupt-Update ----------

  update(dt, input) {
    this.input = input;

    if (input.mutePressed()) {
      const m = sfx.toggleMute();
      this.addPopup(m ? "Ton aus" : "Ton an", { size: 26, dur: 0.8, color: "#cfd8ea" });
    }

    this.buttons = this.computeButtons();
    this.hoverButton = null;
    for (const b of this.buttons) {
      const mx = input.mouse.x;
      const my = input.mouse.y;
      if (mx >= b.x && mx <= b.x + b.w && my >= b.y && my <= b.y + b.h) {
        this.hoverButton = b;
        if (input.mouse.clicked) this.onButton(b.id);
      }
    }

    switch (this.state) {
      case "menu":
        this.stepMatch(dt, true);
        if (input.pressed("Enter")) this.onButton("start");
        break;

      case "kickoff":
        this.kickoffTimer -= dt;
        if (this.kickoffTimer <= 0) {
          this.state = "play";
          sfx.whistleKickoff();
        }
        break;

      case "play":
        if (input.pausePressed()) this.paused = !this.paused;
        if (!this.paused) {
          this.stepMatch(dt, false);
          if (!this.goldenGoal) {
            this.time -= dt;
            if (this.time <= 0) {
              this.time = 0;
              if (this.score[0] !== this.score[1]) {
                this.endMatch();
              } else {
                this.goldenGoal = true;
                sfx.whistleKickoff();
                this.addPopup("VERLÄNGERUNG", {
                  sub: "Golden Goal – das nächste Tor gewinnt!",
                  size: 56,
                  dur: 2.6,
                  color: "#ffd166",
                });
              }
            }
          }
        }
        break;

      case "goal":
        this.goalTimer -= dt;
        this.ball.update(dt);
        this.updateBallBounds(false);
        if (this.goalTimer <= 0) {
          if (this.goldenGoal) {
            this.endMatch();
          } else {
            this.kickoffSetup(this.goalTeam === TEAM_BLUE ? TEAM_RED : TEAM_BLUE);
            this.state = "kickoff";
          }
        }
        break;

      case "fulltime":
        if (input.pressed("Enter")) this.onButton("again");
        break;
    }

    this.updateFX(dt);
  }

  onButton(id) {
    sfx.ensure();
    if (id.startsWith("diff:")) {
      this.settings.difficulty = id.split(":")[1];
    } else if (id.startsWith("time:")) {
      this.settings.matchTime = parseInt(id.split(":")[1], 10);
    } else if (id === "start" || id === "again" || id === "restart") {
      this.startMatch();
    } else if (id === "resume") {
      this.paused = false;
    } else if (id === "menu") {
      this.paused = false;
      this.state = "menu";
      this.kickoffSetup(TEAM_BLUE);
      this.kickoffTimer = 0;
    }
  }

  computeButtons() {
    const btns = [];
    const cx = W / 2;
    if (this.state === "menu") {
      const diffs = [
        ["easy", "Leicht"],
        ["mid", "Mittel"],
        ["hard", "Schwer"],
      ];
      const bw = 150;
      const gap = 18;
      let x = cx - (bw * 3 + gap * 2) / 2;
      for (const [key, label] of diffs) {
        btns.push({
          id: "diff:" + key,
          x,
          y: 356,
          w: bw,
          h: 52,
          label,
          selected: this.settings.difficulty === key,
        });
        x += bw + gap;
      }
      const times = [
        [120, "2 Min"],
        [180, "3 Min"],
        [300, "5 Min"],
      ];
      const tw = 120;
      x = cx - (tw * 3 + gap * 2) / 2;
      for (const [val, label] of times) {
        btns.push({
          id: "time:" + val,
          x,
          y: 470,
          w: tw,
          h: 52,
          label,
          selected: this.settings.matchTime === val,
        });
        x += tw + gap;
      }
      btns.push({ id: "start", x: cx - 150, y: 566, w: 300, h: 66, label: "ANPFIFF!", big: true });
    } else if (this.state === "play" && this.paused) {
      btns.push({ id: "resume", x: cx - 130, y: 340, w: 260, h: 54, label: "Weiter" });
      btns.push({ id: "restart", x: cx - 130, y: 410, w: 260, h: 54, label: "Neustart" });
      btns.push({ id: "menu", x: cx - 130, y: 480, w: 260, h: 54, label: "Hauptmenü" });
    } else if (this.state === "fulltime") {
      btns.push({ id: "again", x: cx - 160, y: 470, w: 320, h: 60, label: "Nochmal spielen", big: true });
      btns.push({ id: "menu", x: cx - 130, y: 550, w: 260, h: 52, label: "Hauptmenü" });
    }
    return btns;
  }

  // ---------- Effekte ----------

  addPopup(text, opts = {}) {
    this.popups.push({
      text,
      sub: opts.sub || null,
      t: 0,
      dur: opts.dur || 1.5,
      size: opts.size || 40,
      color: opts.color || "#ffffff",
    });
  }

  spawnBurst(x, y, n, colors, life = 1.6, speed = 320) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = randRange(speed * 0.25, speed);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s - speed * 0.35,
        life: randRange(life * 0.5, life),
        maxLife: life,
        size: randRange(3, 7),
        color: colors[Math.floor(Math.random() * colors.length)],
        rot: Math.random() * Math.PI,
        vrot: randRange(-8, 8),
      });
    }
  }

  updateFX(dt) {
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < p.dur);

    for (const pt of this.particles) {
      pt.life -= dt;
      pt.vy += 620 * dt; // Schwerkraft
      pt.vx *= Math.pow(0.4, dt);
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.rot += pt.vrot * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    this.shake = Math.max(0, this.shake - dt * 14);
  }
}
