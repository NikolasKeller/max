"use strict";

// Spielfeld-Geometrie (interne Auflösung 1280x720)
const W = 1280;
const H = 720;
const FIELD = { left: 100, right: 1180, top: 90, bottom: 650 };
const CENTER = { x: (FIELD.left + FIELD.right) / 2, y: (FIELD.top + FIELD.bottom) / 2 };
const GOAL_HALF = 74; // halbe Breite der Toröffnung
const GOAL_DEPTH = 42; // Tiefe des Tornetzes
const POST_R = 5; // Pfosten-Radius für Kollisionen

const TEAM_BLUE = 0; // Mensch, spielt von links nach rechts
const TEAM_RED = 1; // CPU, spielt von rechts nach links

const TEAM_INFO = [
  { name: "DU", color: "#2e7bff", colorDark: "#1a4dbf", gk: "#8ff0a4" },
  { name: "CPU", color: "#ff4646", colorDark: "#b52222", gk: "#ffd166" },
];

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function vlen(x, y) {
  return Math.hypot(x, y);
}

function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

// Normalisiert einen Vektor; Nullvektor bleibt Null.
function vnorm(x, y) {
  const l = Math.hypot(x, y);
  return l > 1e-6 ? { x: x / l, y: y / l } : { x: 0, y: 0 };
}

function randRange(a, b) {
  return a + Math.random() * (b - a);
}

// Näherung einer Normalverteilung für natürliche Streuung
function gaussRand() {
  return (Math.random() + Math.random() + Math.random()) * 2 - 3;
}

// Abstand eines Punktes p zur Strecke a-b (für "freie Schussbahn"-Checks)
function pointSegDist(p, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const l2 = abx * abx + aby * aby;
  if (l2 < 1e-6) return dist(p, a);
  let t = ((p.x - a.x) * abx + (p.y - a.y) * aby) / l2;
  t = clamp(t, 0, 1);
  return Math.hypot(p.x - (a.x + abx * t), p.y - (a.y + aby * t));
}

// Mittelpunkt des Tores, auf das Team `team` schießt
function attackGoalCenter(team) {
  return { x: team === TEAM_BLUE ? FIELD.right : FIELD.left, y: CENTER.y };
}

// X-Koordinate der eigenen Torlinie
function ownGoalX(team) {
  return team === TEAM_BLUE ? FIELD.left : FIELD.right;
}

// Angriffsrichtung: +1 nach rechts, -1 nach links
function attackDir(team) {
  return team === TEAM_BLUE ? 1 : -1;
}

function formatTime(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m + ":" + String(r).padStart(2, "0");
}
