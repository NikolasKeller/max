"use strict";

(function () {
  const canvas = document.getElementById("game");
  const input = new Input(canvas);
  const game = new Game();
  const renderer = new Renderer(canvas);

  let last = performance.now();

  function frame(now) {
    // dt begrenzen, damit nach Tab-Wechseln nichts "explodiert"
    const dt = Math.min((now - last) / 1000, 1 / 30);
    last = now;

    game.update(dt, input);
    renderer.draw(game);
    input.endFrame();

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
})();
