"use strict";

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.fieldCache = this.buildField();
  }

  // Statisches Spielfeld einmalig auf ein Offscreen-Canvas zeichnen
  buildField() {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    const cy = CENTER.y;

    // Stadion-Hintergrund
    const bg = ctx.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, 900);
    bg.addColorStop(0, "#15202f");
    bg.addColorStop(1, "#090e18");
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Publikum als Farbpunkte rund ums Feld
    const crowdColors = ["#5a6b8c", "#7c5f6e", "#5f7c6a", "#8c815a", "#6d5a8c"];
    for (let i = 0; i < 900; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      if (
        x > FIELD.left - 62 &&
        x < FIELD.right + 62 &&
        y > FIELD.top - 52 &&
        y < FIELD.bottom + 52
      ) {
        continue;
      }
      ctx.fillStyle = crowdColors[Math.floor(Math.random() * crowdColors.length)];
      ctx.globalAlpha = randRange(0.12, 0.4);
      ctx.beginPath();
      ctx.arc(x, y, randRange(1.6, 3.2), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Auslaufzone + Bande
    ctx.fillStyle = "#1d5c31";
    rr(ctx, FIELD.left - 34, FIELD.top - 30, FIELD.right - FIELD.left + 68, FIELD.bottom - FIELD.top + 60, 14);
    ctx.fill();
    // Bandenwerbung: abwechselnde Segmente
    const bandCols = ["#25355a", "#1b2740"];
    ctx.save();
    rr(ctx, FIELD.left - 40, FIELD.top - 36, FIELD.right - FIELD.left + 80, FIELD.bottom - FIELD.top + 72, 16);
    ctx.lineWidth = 12;
    ctx.strokeStyle = bandCols[0];
    ctx.stroke();
    ctx.setLineDash([46, 46]);
    ctx.strokeStyle = bandCols[1];
    ctx.stroke();
    ctx.restore();

    // Rasenstreifen
    const stripes = 12;
    const sw = (FIELD.right - FIELD.left) / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#2f9e46" : "#2a9040";
      ctx.fillRect(FIELD.left + i * sw, FIELD.top, sw + 1, FIELD.bottom - FIELD.top);
    }
    // dezente Beleuchtung auf dem Rasen
    const glow = ctx.createRadialGradient(W / 2, cy, 80, W / 2, cy, 620);
    glow.addColorStop(0, "rgba(255,255,240,0.10)");
    glow.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = glow;
    ctx.fillRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);

    // Linien
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 3;
    ctx.strokeRect(FIELD.left, FIELD.top, FIELD.right - FIELD.left, FIELD.bottom - FIELD.top);
    ctx.beginPath();
    ctx.moveTo(W / 2, FIELD.top);
    ctx.lineTo(W / 2, FIELD.bottom);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, cy, 72, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(W / 2, cy, 4, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    ctx.fill();

    // Strafräume, Torräume, Elfmeterpunkte
    for (const side of [-1, 1]) {
      const gx = side === -1 ? FIELD.left : FIELD.right;
      const dir = side === -1 ? 1 : -1;
      ctx.strokeRect(
        side === -1 ? gx : gx - 150,
        cy - 145,
        150,
        290
      );
      ctx.strokeRect(side === -1 ? gx : gx - 58, cy - 92, 58, 184);
      ctx.beginPath();
      ctx.arc(gx + dir * 105, cy, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(gx + dir * 105, cy, 62, 0, Math.PI * 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(side === -1 ? gx + 150 : gx - 150 - 62, cy - 70, 62, 140);
      ctx.clip();
      ctx.beginPath();
      ctx.arc(gx + dir * 105, cy, 62, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Eckbögen
    ctx.lineWidth = 2.5;
    for (const [cxk, cyk, a0, a1] of [
      [FIELD.left, FIELD.top, 0, Math.PI / 2],
      [FIELD.right, FIELD.top, Math.PI / 2, Math.PI],
      [FIELD.right, FIELD.bottom, Math.PI, Math.PI * 1.5],
      [FIELD.left, FIELD.bottom, Math.PI * 1.5, Math.PI * 2],
    ]) {
      ctx.beginPath();
      ctx.arc(cxk, cyk, 14, a0, a1);
      ctx.stroke();
    }

    // Tore mit Netz
    for (const side of [-1, 1]) {
      const gx = side === -1 ? FIELD.left : FIELD.right;
      const nx = side === -1 ? gx - GOAL_DEPTH : gx;
      this.drawNet(ctx, nx, cy - GOAL_HALF, GOAL_DEPTH, GOAL_HALF * 2);
      // Rahmen + Pfosten
      ctx.strokeStyle = "#f4f6fb";
      ctx.lineWidth = 4;
      ctx.strokeRect(nx, cy - GOAL_HALF, GOAL_DEPTH, GOAL_HALF * 2);
      ctx.fillStyle = "#f4f6fb";
      for (const gy of [cy - GOAL_HALF, cy + GOAL_HALF]) {
        ctx.beginPath();
        ctx.arc(gx, gy, POST_R + 1, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    return c;
  }

  drawNet(ctx, x, y, w, h) {
    ctx.fillStyle = "rgba(240,245,255,0.10)";
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = "rgba(240,245,255,0.30)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let gx = x; gx <= x + w; gx += 8) {
      ctx.moveTo(gx, y);
      ctx.lineTo(gx, y + h);
    }
    for (let gy = y; gy <= y + h; gy += 8) {
      ctx.moveTo(x, gy);
      ctx.lineTo(x + w, gy);
    }
    ctx.stroke();
  }

  draw(game) {
    const ctx = this.ctx;
    const t = performance.now() / 1000;
    ctx.save();
    if (game.shake > 0) {
      ctx.translate(randRange(-game.shake, game.shake), randRange(-game.shake, game.shake));
    }

    ctx.drawImage(this.fieldCache, 0, 0);

    // Schatten
    for (const p of game.players) this.drawShadow(ctx, p.pos.x, p.pos.y, p.r);
    this.drawShadow(ctx, game.ball.pos.x, game.ball.pos.y, game.ball.r);

    // Spieler nach y sortiert zeichnen (leichter Tiefeneindruck)
    const sorted = [...game.players].sort((a, b) => a.pos.y - b.pos.y);
    for (const p of sorted) this.drawPlayer(ctx, game, p, t);

    this.drawBall(ctx, game.ball);

    // Ball im Netz? Netz nochmal darüber zeichnen
    const b = game.ball;
    if (
      Math.abs(b.pos.y - CENTER.y) < GOAL_HALF &&
      (b.pos.x < FIELD.left || b.pos.x > FIELD.right)
    ) {
      const side = b.pos.x < FIELD.left ? -1 : 1;
      const nx = side === -1 ? FIELD.left - GOAL_DEPTH : FIELD.right;
      this.drawNet(ctx, nx, CENTER.y - GOAL_HALF, GOAL_DEPTH, GOAL_HALF * 2);
    }

    // Partikel
    for (const pt of game.particles) {
      ctx.save();
      ctx.globalAlpha = clamp(pt.life / (pt.maxLife * 0.5), 0, 1);
      ctx.translate(pt.x, pt.y);
      ctx.rotate(pt.rot);
      ctx.fillStyle = pt.color;
      ctx.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.7);
      ctx.restore();
    }

    ctx.restore(); // Shake-Ende

    // HUD & Overlays (ohne Shake)
    if (game.state !== "menu") this.drawHUD(ctx, game, t);
    this.drawPopups(ctx, game);

    if (game.state === "menu") this.drawMenu(ctx, game, t);
    if (game.state === "kickoff") this.drawKickoff(ctx, game);
    if (game.state === "play" && game.paused) this.drawPause(ctx, game);
    if (game.state === "fulltime") this.drawFulltime(ctx, game, t);

    this.drawSpeaker(ctx, W - 36, 30, sfx.muted);
    this.canvas.style.cursor = game.hoverButton ? "pointer" : "default";
  }

  drawShadow(ctx, x, y, r) {
    ctx.save();
    ctx.fillStyle = "rgba(0,20,5,0.28)";
    ctx.beginPath();
    ctx.ellipse(x + 3, y + 5, r * 1.05, r * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawPlayer(ctx, game, p, t) {
    const info = TEAM_INFO[p.team];
    const isGK = p.role === ROLE_GK;
    const col = isGK ? info.gk : info.color;
    const colDark = isGK ? "#3b7a4b" : info.colorDark;

    // Ring um den aktuellen Ballführer (falls nicht der gesteuerte Spieler)
    if ((game.ballCarrier === p || game.ball.heldBy === p) && p !== game.controlled) {
      ctx.save();
      ctx.strokeStyle = info.color;
      ctx.globalAlpha = 0.55;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.r + 5, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Markierung des gesteuerten Spielers
    if (p === game.controlled && game.state !== "menu") {
      ctx.save();
      ctx.strokeStyle = "rgba(255,225,80," + (0.65 + 0.3 * Math.sin(t * 6)) + ")";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.r + 6, 0, Math.PI * 2);
      ctx.stroke();
      // Pfeil über dem Kopf
      const ay = p.pos.y - p.r - 16 + Math.sin(t * 5) * 2.5;
      ctx.fillStyle = "#ffe150";
      ctx.beginPath();
      ctx.moveTo(p.pos.x - 7, ay - 8);
      ctx.lineTo(p.pos.x + 7, ay - 8);
      ctx.lineTo(p.pos.x, ay);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // Körper
    const g = ctx.createRadialGradient(
      p.pos.x - p.r * 0.35,
      p.pos.y - p.r * 0.4,
      p.r * 0.2,
      p.pos.x,
      p.pos.y,
      p.r * 1.15
    );
    g.addColorStop(0, this.lighten(col, 30));
    g.addColorStop(1, col);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.pos.x, p.pos.y, p.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = colDark;
    ctx.stroke();

    // Blickrichtungs-Punkt
    ctx.fillStyle = colDark;
    ctx.beginPath();
    ctx.arc(p.pos.x + p.facing.x * (p.r - 3), p.pos.y + p.facing.y * (p.r - 3), 3.4, 0, Math.PI * 2);
    ctx.fill();

    // Rückennummer
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.font = "bold 11px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(String(p.number), p.pos.x, p.pos.y + 0.5);

    // Schuss-Aufladung: Ziellinie, pulsierender Ring und Ladebalken
    if (p === game.controlled && p.charge >= 0) {
      const hue = lerp(52, 5, p.charge);
      const chargeCol = `hsl(${hue}, 95%, 58%)`;

      // gestrichelte Ziellinie in Schussrichtung
      ctx.save();
      ctx.strokeStyle = chargeCol;
      ctx.globalAlpha = 0.85;
      ctx.lineWidth = 3;
      ctx.setLineDash([7, 7]);
      ctx.lineDashOffset = -t * 40;
      const len = 40 + p.charge * 75;
      ctx.beginPath();
      ctx.moveTo(p.pos.x + p.facing.x * (p.r + 4), p.pos.y + p.facing.y * (p.r + 4));
      ctx.lineTo(p.pos.x + p.facing.x * (p.r + 4 + len), p.pos.y + p.facing.y * (p.r + 4 + len));
      ctx.stroke();
      ctx.setLineDash([]);

      // wachsender Ring um den Spieler
      ctx.globalAlpha = 0.9;
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(p.pos.x, p.pos.y, p.r + 7 + p.charge * 6, -Math.PI / 2, -Math.PI / 2 + p.charge * Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      // Ladebalken
      const bw = 52;
      const bx = p.pos.x - bw / 2;
      const by = p.pos.y - p.r - 34;
      ctx.fillStyle = "rgba(10,14,24,0.85)";
      rr(ctx, bx - 2, by - 2, bw + 4, 12, 6);
      ctx.fill();
      ctx.fillStyle = chargeCol;
      rr(ctx, bx, by, Math.max(4, bw * p.charge), 8, 4);
      ctx.fill();
    }
  }

  drawBall(ctx, ball) {
    const { x, y } = ball.pos;
    const r = ball.r;
    const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, r * 1.2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#cfd6e0");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#7a8494";
    ctx.lineWidth = 1.2;
    ctx.stroke();

    // rotierendes Fleckenmuster
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, r - 0.8, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#232a36";
    for (let i = 0; i < 5; i++) {
      const a = ball.rot + (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(x, y, 1.8, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawHUD(ctx, game, t) {
    // Scoreboard
    const bw = 340;
    const bx = W / 2 - bw / 2;
    ctx.save();
    ctx.fillStyle = "rgba(8,13,24,0.82)";
    rr(ctx, bx, 12, bw, 58, 14);
    ctx.fill();
    ctx.strokeStyle = "rgba(120,150,210,0.35)";
    ctx.lineWidth = 1.5;
    rr(ctx, bx, 12, bw, 58, 14);
    ctx.stroke();

    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Teamnamen + Farbpunkte
    for (const team of [TEAM_BLUE, TEAM_RED]) {
      const info = TEAM_INFO[team];
      const name = game.spectator ? (team === TEAM_BLUE ? "BLAU" : "ROT") : info.name;
      const tx = team === TEAM_BLUE ? bx + 70 : bx + bw - 70;
      ctx.fillStyle = info.color;
      ctx.beginPath();
      ctx.arc(tx + (team === TEAM_BLUE ? -40 : 40), 34, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#e8edf7";
      ctx.font = "bold 20px system-ui, sans-serif";
      ctx.fillText(name, tx, 34);
    }

    // Spielstand
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.fillText(`${game.score[0]} : ${game.score[1]}`, W / 2, 33);

    // Zeit / Golden Goal
    if (game.goldenGoal) {
      ctx.fillStyle = `rgba(255,209,102,${0.7 + 0.3 * Math.sin(t * 5)})`;
      ctx.font = "bold 13px system-ui, sans-serif";
      ctx.fillText("GOLDEN GOAL", W / 2, 58);
    } else {
      ctx.fillStyle = game.time < 20 && game.state === "play" ? "#ffb1b1" : "#aab6cc";
      ctx.font = "bold 15px system-ui, sans-serif";
      ctx.fillText(formatTime(game.time), W / 2, 58);
    }
    ctx.restore();

    // Steuerungshinweise
    if (game.state === "play" || game.state === "kickoff") {
      ctx.save();
      ctx.fillStyle = "rgba(214,224,240,0.5)";
      ctx.font = "13px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        game.spectator
          ? "Demo-Modus: KI gegen KI    ·    P: Pause    ·    M: Ton"
          : "WASD / Pfeile: Laufen    ·    Leertaste halten + loslassen: Schuss    ·    E: Pass    ·    P: Pause    ·    M: Ton",
        W / 2,
        H - 22
      );
      ctx.restore();
    }
  }

  drawPopups(ctx, game) {
    for (const p of game.popups) {
      const prog = p.t / p.dur;
      let scale = 1;
      if (p.t < 0.18) scale = lerp(0.4, 1.12, p.t / 0.18);
      else if (p.t < 0.3) scale = lerp(1.12, 1, (p.t - 0.18) / 0.12);
      const alpha = prog > 0.75 ? 1 - (prog - 0.75) / 0.25 : 1;
      ctx.save();
      ctx.translate(W / 2, H * 0.36);
      ctx.scale(scale, scale);
      ctx.globalAlpha = alpha;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = `900 ${p.size}px system-ui, sans-serif`;
      ctx.lineWidth = p.size / 9;
      ctx.strokeStyle = "rgba(8,12,20,0.85)";
      ctx.strokeText(p.text, 0, 0);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, 0, 0);
      if (p.sub) {
        ctx.font = `bold ${Math.max(18, p.size * 0.3)}px system-ui, sans-serif`;
        ctx.lineWidth = 4;
        ctx.strokeText(p.sub, 0, p.size * 0.72);
        ctx.fillStyle = "#ffffff";
        ctx.fillText(p.sub, 0, p.size * 0.72);
      }
      ctx.restore();
    }
  }

  drawButton(ctx, game, b) {
    const hover = game.hoverButton === b;
    ctx.save();
    if (b.big) {
      const g = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
      g.addColorStop(0, hover ? "#3ecb62" : "#2eb850");
      g.addColorStop(1, hover ? "#28a24a" : "#1f8f3d");
      ctx.fillStyle = g;
    } else if (b.selected) {
      ctx.fillStyle = hover ? "#2f4f8f" : "#28437c";
    } else {
      ctx.fillStyle = hover ? "#20304f" : "#16233c";
    }
    rr(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.fill();
    ctx.lineWidth = b.selected ? 2.5 : 1.5;
    ctx.strokeStyle = b.big
      ? "rgba(255,255,255,0.5)"
      : b.selected
        ? "#7da4ff"
        : hover
          ? "#5f7cb8"
          : "#3b4f77";
    rr(ctx, b.x, b.y, b.w, b.h, 12);
    ctx.stroke();
    ctx.fillStyle = "#f2f6ff";
    ctx.font = `${b.big ? "900 26px" : "bold 20px"} system-ui, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    ctx.restore();
  }

  drawOverlayBg(ctx, alpha = 0.62) {
    ctx.fillStyle = `rgba(6,10,18,${alpha})`;
    ctx.fillRect(0, 0, W, H);
  }

  drawMenu(ctx, game, t) {
    this.drawOverlayBg(ctx, 0.66);
    ctx.save();
    ctx.textAlign = "center";

    // Titel mit Ball-Logo
    const ty = 170 + Math.sin(t * 1.6) * 4;
    ctx.font = "900 92px system-ui, sans-serif";
    ctx.lineWidth = 10;
    ctx.strokeStyle = "rgba(0,0,0,0.6)";
    ctx.strokeText("BLITZKICK", W / 2 + 30, ty);
    const grad = ctx.createLinearGradient(0, ty - 46, 0, ty + 46);
    grad.addColorStop(0, "#ffffff");
    grad.addColorStop(0.55, "#cfe0ff");
    grad.addColorStop(1, "#7da4ff");
    ctx.fillStyle = grad;
    ctx.fillText("BLITZKICK", W / 2 + 30, ty);
    this.drawLogoBall(ctx, W / 2 - 318, ty - 8, 34, t);

    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillStyle = "#aab9d8";
    ctx.fillText("Das 5-gegen-5 Arcade-Fußballspiel", W / 2, 232);

    ctx.font = "bold 17px system-ui, sans-serif";
    ctx.fillStyle = "#8fa3c8";
    ctx.fillText("SCHWIERIGKEIT", W / 2, 338);
    ctx.fillText("SPIELZEIT", W / 2, 452);

    for (const b of game.buttons) this.drawButton(ctx, game, b);

    ctx.font = "14px system-ui, sans-serif";
    ctx.fillStyle = "rgba(200,212,235,0.65)";
    ctx.fillText(
      "Steuerung:  WASD / Pfeile bewegen  ·  Leertaste halten & loslassen = Schuss  ·  E = Pass  ·  P = Pause  ·  M = Ton",
      W / 2,
      672
    );
    ctx.fillStyle = "rgba(200,212,235,0.4)";
    ctx.fillText("Enter startet das Spiel · Bei Gleichstand entscheidet ein Golden Goal", W / 2, 694);
    ctx.restore();
  }

  drawLogoBall(ctx, x, y, r, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.8);
    const g = ctx.createRadialGradient(-r * 0.3, -r * 0.3, 2, 0, 0, r * 1.2);
    g.addColorStop(0, "#ffffff");
    g.addColorStop(1, "#c6cede");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#5d6878";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = "#232a36";
    for (let i = 0; i < 5; i++) {
      const a = (i * Math.PI * 2) / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.58, Math.sin(a) * r * 0.58, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  drawKickoff(ctx, game) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "900 64px system-ui, sans-serif";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(8,12,20,0.8)";
    ctx.strokeText("ANSTOSS", W / 2, H * 0.4);
    ctx.fillStyle = "#ffffff";
    ctx.fillText("ANSTOSS", W / 2, H * 0.4);
    ctx.font = "bold 24px system-ui, sans-serif";
    const who = game.spectator
      ? game.kickoffTeam === TEAM_BLUE
        ? "Blau beginnt"
        : "Rot beginnt"
      : game.kickoffTeam === TEAM_BLUE
        ? "Du beginnst"
        : "Die CPU beginnt";
    ctx.lineWidth = 5;
    ctx.strokeText(who, W / 2, H * 0.4 + 52);
    ctx.fillStyle = "#ffd166";
    ctx.fillText(who, W / 2, H * 0.4 + 52);
    ctx.restore();
  }

  drawPause(ctx, game) {
    this.drawOverlayBg(ctx, 0.6);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "900 68px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("PAUSE", W / 2, 280);
    for (const b of game.buttons) this.drawButton(ctx, game, b);
    ctx.restore();
  }

  drawFulltime(ctx, game, t) {
    this.drawOverlayBg(ctx, 0.7);
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = "900 72px system-ui, sans-serif";
    ctx.fillStyle = "#ffffff";
    ctx.fillText("ABPFIFF!", W / 2, 220);

    ctx.font = "900 84px system-ui, sans-serif";
    const humanWon = game.score[0] > game.score[1];
    ctx.fillStyle = humanWon ? "#ffd166" : "#ff8f8f";
    ctx.fillText(`${game.score[0]} : ${game.score[1]}`, W / 2, 330);

    ctx.font = "bold 34px system-ui, sans-serif";
    let verdict;
    if (game.spectator) {
      verdict = humanWon ? "BLAU gewinnt die Demo!" : "ROT gewinnt die Demo!";
      ctx.fillStyle = humanWon ? "#7da4ff" : "#ff8f8f";
    } else {
      verdict = humanWon ? "DU GEWINNST! Was für ein Spiel!" : "Die CPU gewinnt – Revanche?";
      ctx.fillStyle = humanWon ? "#7bffb0" : "#ffb1b1";
    }
    ctx.fillText(verdict, W / 2, 402);

    for (const b of game.buttons) this.drawButton(ctx, game, b);
    ctx.restore();
  }

  drawSpeaker(ctx, x, y, muted) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = "rgba(220,230,248,0.75)";
    ctx.beginPath();
    ctx.moveTo(-10, -4);
    ctx.lineTo(-4, -4);
    ctx.lineTo(3, -10);
    ctx.lineTo(3, 10);
    ctx.lineTo(-4, 4);
    ctx.lineTo(-10, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "rgba(220,230,248,0.75)";
    ctx.lineWidth = 2;
    if (muted) {
      ctx.beginPath();
      ctx.moveTo(7, -6);
      ctx.lineTo(15, 6);
      ctx.moveTo(15, -6);
      ctx.lineTo(7, 6);
      ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.arc(4, 0, 8, -0.9, 0.9);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(4, 0, 12, -0.8, 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = clamp((n >> 16) + amt, 0, 255);
    const g = clamp(((n >> 8) & 0xff) + amt, 0, 255);
    const b = clamp((n & 0xff) + amt, 0, 255);
    return `rgb(${r},${g},${b})`;
  }
}
