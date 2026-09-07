"use strict";

// Schwierigkeitsgrade des CPU-Teams
const DIFFICULTIES = {
  easy: { label: "Leicht", speed: 0.82, react: 0.32, aimErr: 0.26, shootRange: 260, passSkill: 0.5 },
  mid: { label: "Mittel", speed: 0.94, react: 0.18, aimErr: 0.13, shootRange: 320, passSkill: 0.75 },
  hard: { label: "Schwer", speed: 1.04, react: 0.07, aimErr: 0.05, shootRange: 380, passSkill: 0.95 },
};

// Fähigkeiten der KI-Mitspieler des Menschen (unabhängig vom Schwierigkeitsgrad)
const MATE_SKILL = { speed: 0.93, react: 0.14, aimErr: 0.12, shootRange: 300, passSkill: 0.8 };

const AI = {
  // Liefert Bewegungsrichtung + führt Aktionen (Schuss/Pass) für einen KI-Spieler aus
  updatePlayer(game, p, dt) {
    const skill = p.team === TEAM_RED ? game.difficulty : MATE_SKILL;
    if (p.role === ROLE_GK) {
      return this.goalkeeper(game, p, skill);
    }

    const ball = game.ball;
    const iAmChaser = game.chaser[p.team] === p;
    const myTeamHasBall = game.possession === p.team;

    if (iAmChaser && !ball.heldBy) {
      const range = p.controlRange(ball);
      if (dist(p.pos, ball.pos) < range && ball.speed() < 420 && p.kickCooldown <= 0) {
        return this.withBall(game, p, skill);
      }
      // Ball jagen (mit kleiner Vorhersage der Ballbewegung)
      const predict = clamp(dist(p.pos, ball.pos) / 400, 0.05, 0.35);
      const tx = ball.pos.x + ball.vel.x * predict;
      const ty = ball.pos.y + ball.vel.y * predict;
      return vnorm(tx - p.pos.x, ty - p.pos.y);
    }

    // Ohne Ball: Position halten, Verteidiger decken die Schusslinie
    let home = p.homePos(ball);
    if (!myTeamHasBall && p.role === ROLE_DEF) {
      const og = { x: ownGoalX(p.team), y: CENTER.y };
      const ballInOwnHalf =
        (p.team === TEAM_BLUE && ball.pos.x < CENTER.x) ||
        (p.team === TEAM_RED && ball.pos.x > CENTER.x);
      if (ballInOwnHalf) {
        // zwischen Ball und eigenem Tor stellen, seitlich versetzt
        home = {
          x: lerp(ball.pos.x, og.x, 0.45),
          y: lerp(ball.pos.y, og.y, 0.35) + p.slot.fy * 55,
        };
      }
    }
    if (myTeamHasBall && (p.role === ROLE_ATT || p.role === ROLE_MID)) {
      // Anspielstation weiter vorne anbieten
      const d = attackDir(p.team);
      home.x = clamp(home.x + d * 70, FIELD.left + 30, FIELD.right - 30);
    }
    const dd = dist(p.pos, home);
    if (dd < 10) return { x: 0, y: 0 };
    const dir = vnorm(home.x - p.pos.x, home.y - p.pos.y);
    // weiter entfernt → schneller zurück
    const urgency = clamp(dd / 120, 0.45, 1);
    return { x: dir.x * urgency, y: dir.y * urgency };
  },

  // Spieler ist am Ball: dribbeln, ausweichen, schießen oder passen
  withBall(game, p, skill) {
    const ball = game.ball;
    const goal = attackGoalCenter(p.team);
    const distGoal = dist(p.pos, goal);

    // Entscheidungen nur im Reaktionstakt treffen
    if (p.decideTimer <= 0) {
      p.decideTimer = skill.react + 0.06;

      const nearestOpp = this.nearestOpponent(game, p);
      const oppDist = nearestOpp ? dist(p.pos, nearestOpp.pos) : 999;

      // Schießen, wenn nah genug am Tor und Bahn halbwegs frei
      if (distGoal < skill.shootRange) {
        const lineBlocked = this.shotBlocked(game, p, goal);
        if (!lineBlocked || distGoal < 150) {
          const targetY = CENTER.y + randRange(-1, 1) * GOAL_HALF * 0.62;
          let ang = Math.atan2(targetY - p.pos.y, goal.x - p.pos.x);
          ang += gaussRand() * skill.aimErr;
          game.doKick(p, Math.cos(ang), Math.sin(ang), randRange(620, 800), "shot");
          return { x: Math.cos(ang), y: Math.sin(ang) };
        }
      }

      // Passen, wenn bedrängt und ein Mitspieler besser steht
      if (oppDist < 75 && Math.random() < skill.passSkill) {
        const mate = this.bestPassTarget(game, p);
        if (mate) {
          game.doPass(p, mate, skill.aimErr);
          return vnorm(mate.pos.x - p.pos.x, mate.pos.y - p.pos.y);
        }
      }
    }

    // Dribbeln Richtung Tor, Gegnern ausweichen, nicht an der Bande kleben
    let sx = (goal.x - p.pos.x) / Math.max(distGoal, 1);
    let sy = (goal.y - p.pos.y) / Math.max(distGoal, 1);
    for (const o of game.players) {
      if (o.team === p.team) continue;
      const d = dist(o.pos, p.pos);
      if (d < 110 && d > 1) {
        const w = ((110 - d) / 110) * 1.15;
        sx += ((p.pos.x - o.pos.x) / d) * w;
        sy += ((p.pos.y - o.pos.y) / d) * w;
      }
    }
    if (p.pos.y < FIELD.top + 70) sy += 0.5;
    if (p.pos.y > FIELD.bottom - 70) sy -= 0.5;
    return vnorm(sx, sy);
  },

  shotBlocked(game, p, goal) {
    for (const o of game.players) {
      if (o.team === p.team || o.role === ROLE_GK) continue;
      if (pointSegDist(o.pos, p.pos, goal) < 26) return true;
    }
    return false;
  },

  nearestOpponent(game, p) {
    let best = null;
    let bd = Infinity;
    for (const o of game.players) {
      if (o.team === p.team) continue;
      const d = dist(o.pos, p.pos);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  },

  // Mitspieler, der frei steht und möglichst weiter vorne ist
  bestPassTarget(game, p) {
    const d = attackDir(p.team);
    let best = null;
    let bestScore = -Infinity;
    for (const m of game.players) {
      if (m.team !== p.team || m === p || m.role === ROLE_GK) continue;
      const dm = dist(m.pos, p.pos);
      if (dm < 60 || dm > 480) continue;
      let score = (m.pos.x - p.pos.x) * d * 1.5 - Math.abs(dm - 220);
      const opp = this.nearestOpponent(game, m);
      if (opp) score += clamp(dist(opp.pos, m.pos), 0, 150);
      // Passweg blockiert?
      for (const o of game.players) {
        if (o.team === p.team) continue;
        if (pointSegDist(o.pos, p.pos, m.pos) < 22) score -= 240;
      }
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    return bestScore > -150 ? best : null;
  },

  goalkeeper(game, gk, skill) {
    const ball = game.ball;
    const d = attackDir(gk.team);
    const gx = ownGoalX(gk.team);
    const lineX = gx + d * 16;

    // Abschlag nach dem Fangen
    if (ball.heldBy === gk) {
      gk.holdTimer -= 1 / 60;
      if (gk.holdTimer <= 0) {
        const mate = this.bestPassTarget(game, gk) || this.anyFieldMate(game, gk);
        let ang;
        if (mate) {
          ang = Math.atan2(mate.pos.y - gk.pos.y, mate.pos.x - gk.pos.x);
        } else {
          ang = Math.atan2(randRange(-0.4, 0.4), d);
        }
        ang += gaussRand() * 0.06;
        game.doKick(gk, Math.cos(ang), Math.sin(ang), 720, "clear");
      }
      return { x: d, y: 0 };
    }

    const ballDist = dist(gk.pos, ball.pos);
    const dangerX = Math.abs(ball.pos.x - gx) < 170;
    const inBox = Math.abs(ball.pos.y - CENTER.y) < GOAL_HALF + 90;

    // Rausstürmen, wenn der Ball langsam und nah vorm Tor liegt
    if (dangerX && inBox && ball.speed() < 320 && ballDist < 150 && !ball.heldBy) {
      return vnorm(ball.pos.x - gk.pos.x, ball.pos.y - gk.pos.y);
    }

    // Sonst: auf der Linie den Ball verfolgen
    let ty = clamp(ball.pos.y, CENTER.y - GOAL_HALF + 10, CENTER.y + GOAL_HALF - 10);
    // Schussbahn antizipieren, wenn der Ball aufs Tor fliegt
    if ((ball.vel.x < -60 && gk.team === TEAM_BLUE) || (ball.vel.x > 60 && gk.team === TEAM_RED)) {
      const t = Math.abs((gx - ball.pos.x) / ball.vel.x);
      if (t < 1.2) {
        const iy = ball.pos.y + ball.vel.y * t;
        ty = clamp(iy, CENTER.y - GOAL_HALF + 8, CENTER.y + GOAL_HALF - 8);
      }
    }
    const tx = lineX;
    const dd = vlen(tx - gk.pos.x, ty - gk.pos.y);
    if (dd < 4) return { x: 0, y: 0 };
    return vnorm(tx - gk.pos.x, ty - gk.pos.y);
  },

  anyFieldMate(game, p) {
    for (const m of game.players) {
      if (m.team === p.team && m.role !== ROLE_GK) return m;
    }
    return null;
  },
};
