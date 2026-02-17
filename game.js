const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const phaseEl = document.getElementById("phase");
const dayEl = document.getElementById("day");
const cashEl = document.getElementById("cash");
const timerEl = document.getElementById("timer");
const rentEl = document.getElementById("rent");
const trafficEl = document.getElementById("traffic");
const inventoryEl = document.getElementById("inventory");
const hintEl = document.getElementById("hint");

const locationButtonsWrap = document.getElementById("locationButtons");
const placeShelfBtn = document.getElementById("placeShelf");
const placeCounterBtn = document.getElementById("placeCounter");
const hireEmployeeBtn = document.getElementById("hireEmployee");
const openNowBtn = document.getElementById("openNow");
const restartBtn = document.getElementById("restart");

const keys = new Set();
const LOCATION_DATA = {
  centre: { name: "Centre-ville", rent: 180, traffic: 1.45, startCash: 1200 },
  residentiel: { name: "Résidentiel", rent: 120, traffic: 1.0, startCash: 1000 },
  banlieue: { name: "Banlieue", rent: 70, traffic: 0.7, startCash: 920 },
};

const SHELF_COST = 120;
const COUNTER_COST = 220;
const EMPLOYEE_DAILY_COST = 80;
const SETUP_TIME = 45;
const DAY_TIME = 70;

let state;

function resetGame() {
  state = {
    phase: "location",
    selectedLocation: null,
    day: 0,
    timer: 0,
    cash: 0,
    inventory: 0,
    employee: { hired: false },
    player: { x: 90, y: 500, w: 24, h: 24, speed: 180 },
    shelves: [],
    counter: null,
    clients: [],
    queue: [],
    spawnAccumulator: 0,
    dayStats: { revenue: 0, expenses: 0, customersServed: 0, customersLost: 0 },
    report: null,
    gameOver: false,
  };
  setHint("Choisis un quartier pour lancer l'aventure.");
  updateControls();
  updateHud();
}

function setHint(text) {
  hintEl.textContent = text;
}

function chooseLocation(id) {
  if (state.phase !== "location") return;
  const location = LOCATION_DATA[id];
  if (!location) return;

  state.selectedLocation = { id, ...location };
  state.cash = location.startCash;
  state.phase = "setup";
  state.timer = SETUP_TIME;
  setHint("Phase installation: place les étagères puis le comptoir avant l'ouverture.");
  updateHud();
  updateControls();
}

function tryPlaceShelf() {
  if (state.phase !== "setup" || state.gameOver) return;
  if (state.cash < SHELF_COST) return setHint("Pas assez de cash pour une étagère.");

  const shelf = {
    x: Math.round(state.player.x - 18),
    y: Math.round(state.player.y - 22),
    w: 58,
    h: 22,
  };
  state.shelves.push(shelf);
  state.cash -= SHELF_COST;
  state.inventory += 8;
  setHint("Étagère posée. Plus d'étagères = plus de films et plus d'achats.");
  updateHud();
}

function tryPlaceCounter() {
  if (state.phase !== "setup" || state.gameOver) return;
  if (state.counter) return setHint("Le comptoir est déjà placé.");
  if (state.cash < COUNTER_COST) return setHint("Pas assez de cash pour le comptoir.");

  state.counter = {
    x: Math.round(state.player.x - 26),
    y: Math.round(state.player.y - 16),
    w: 98,
    h: 36,
  };
  state.cash -= COUNTER_COST;
  setHint("Comptoir placé. Engage un employé ou tiens la caisse toi-même.");
  updateHud();
  updateControls();
}

function tryHireEmployee() {
  if (state.phase !== "setup" || state.gameOver) return;
  if (!state.counter) return setHint("Place d'abord le comptoir pour engager quelqu'un.");
  if (state.employee.hired) return setHint("Employé déjà engagé.");

  state.employee.hired = true;
  setHint("Employé engagé: il encaissera automatiquement pendant l'ouverture.");
  updateControls();
}

function startDay() {
  if (state.phase !== "setup" || state.gameOver) return;
  if (!state.counter || state.shelves.length === 0) {
    setHint("Il faut au moins 1 étagère et 1 comptoir avant d'ouvrir.");
    return;
  }

  state.phase = "open";
  state.day += 1;
  state.timer = DAY_TIME;
  state.clients = [];
  state.queue = [];
  state.spawnAccumulator = 0;
  state.dayStats = { revenue: 0, expenses: 0, customersServed: 0, customersLost: 0 };
  setHint("Boutique ouverte ! Servis vite les clients à la caisse.");
  updateHud();
  updateControls();
}

function closeDay() {
  const locationRent = state.selectedLocation.rent;
  const salary = state.employee.hired ? EMPLOYEE_DAILY_COST : 0;
  const refillCost = Math.max(20, Math.floor(state.shelves.length * 7));
  const expenses = locationRent + salary + refillCost;

  state.cash -= expenses;
  state.dayStats.expenses = expenses;
  state.inventory += Math.max(6, state.shelves.length * 2);

  const profit = state.dayStats.revenue - expenses;
  state.report = {
    day: state.day,
    revenue: state.dayStats.revenue,
    expenses,
    profit,
    served: state.dayStats.customersServed,
    lost: state.dayStats.customersLost,
    cashAfter: state.cash,
  };

  if (state.cash < 0) {
    state.phase = "gameover";
    state.gameOver = true;
    setHint("Tu es en négatif. Fin de partie, relance une nouvelle gestion.");
  } else {
    state.phase = "report";
    setHint("Fin de journée: regarde ton bilan puis lance la prochaine installation.");
  }

  state.timer = 0;
  state.clients = [];
  state.queue = [];
  updateHud();
  updateControls();
}

function startNextSetup() {
  if (state.phase !== "report" || state.gameOver) return;
  state.phase = "setup";
  state.timer = SETUP_TIME;
  state.report = null;
  setHint("Nouvelle journée: ajuste ton aménagement si besoin puis ouvre.");
  updateHud();
  updateControls();
}

function updateHud() {
  const phaseNames = {
    location: "Choix de quartier",
    setup: "Installation",
    open: "Ouvert",
    report: "Bilan de fin de journée",
    gameover: "Faillite",
  };

  phaseEl.textContent = `Phase: ${phaseNames[state.phase]}`;
  dayEl.textContent = `Jour: ${state.day}`;
  cashEl.textContent = `Cash: ${Math.floor(state.cash)}€`;
  timerEl.textContent = `Temps: ${Math.max(0, Math.ceil(state.timer))}s`;
  rentEl.textContent = `Loyer: ${state.selectedLocation ? state.selectedLocation.rent : 0}€ / jour`;
  trafficEl.textContent = `Passage: ${state.selectedLocation ? state.selectedLocation.name : "-"}`;
  inventoryEl.textContent = `Films en stock: ${Math.max(0, state.inventory)}`;
}

function updateControls() {
  const onLocation = state.phase === "location";
  const onSetup = state.phase === "setup";

  [...locationButtonsWrap.querySelectorAll("button")].forEach((btn) => {
    btn.disabled = !onLocation;
  });

  placeShelfBtn.disabled = !onSetup;
  placeCounterBtn.disabled = !onSetup;
  hireEmployeeBtn.disabled = !onSetup;
  openNowBtn.disabled = !onSetup;
  openNowBtn.textContent = state.phase === "report" ? "Continuer" : "Ouvrir plus tôt";
}

function spawnClient() {
  const available = state.shelves.length > 0 && state.inventory > 0;
  const patience = 12 + Math.random() * 8;

  state.clients.push({
    x: 30,
    y: 80 + Math.random() * 420,
    w: 20,
    h: 20,
    speed: 38 + Math.random() * 20,
    state: available ? "browse" : "leave",
    browseTimer: 2 + Math.random() * 3,
    patience,
    hasMovie: false,
    value: 7 + Math.floor(Math.random() * 7),
  });
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function movePlayer(delta) {
  const p = state.player;
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowUp") || keys.has("w") || keys.has("z")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("q")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;

  if (dx !== 0 || dy !== 0) {
    const norm = Math.hypot(dx, dy) || 1;
    p.x += (dx / norm) * p.speed * delta;
    p.y += (dy / norm) * p.speed * delta;
  }

  p.x = Math.max(18, Math.min(canvas.width - p.w - 18, p.x));
  p.y = Math.max(58, Math.min(canvas.height - p.h - 18, p.y));
}

function updateOpenPhase(delta) {
  state.timer -= delta;
  movePlayer(delta);

  const traffic = state.selectedLocation.traffic;
  state.spawnAccumulator += delta * traffic;
  const spawnRate = Math.max(0.5, 2.4 - traffic);
  while (state.spawnAccumulator >= spawnRate) {
    state.spawnAccumulator -= spawnRate;
    spawnClient();
  }

  for (const client of state.clients) {
    client.patience -= delta;

    if (client.state === "browse") {
      client.x += client.speed * delta;
      client.browseTimer -= delta;
      if (client.browseTimer <= 0) {
        if (state.inventory > 0) {
          state.inventory -= 1;
          client.hasMovie = true;
          client.state = "queue";
          state.queue.push(client);
        } else {
          client.state = "leave";
        }
      }
    } else if (client.state === "queue") {
      const spotIndex = state.queue.indexOf(client);
      const targetX = state.counter ? state.counter.x - 30 - spotIndex * 24 : 100;
      const targetY = state.counter ? state.counter.y + 8 : 160;

      client.x += Math.sign(targetX - client.x) * client.speed * delta;
      client.y += Math.sign(targetY - client.y) * client.speed * delta;

      if (state.employee.hired && spotIndex === 0) {
        checkoutFirstClient();
      }
    } else if (client.state === "leave") {
      client.x += client.speed * delta;
    }

    if (client.patience <= 0 && client.state !== "leave") {
      client.state = "leave";
      const idx = state.queue.indexOf(client);
      if (idx >= 0) state.queue.splice(idx, 1);
      state.dayStats.customersLost += 1;
    }
  }

  state.clients = state.clients.filter((c) => c.x < canvas.width + 40);

  if (state.timer <= 0) {
    closeDay();
  }

  updateHud();
}

function checkoutFirstClient() {
  if (!state.counter || state.queue.length === 0) return;
  const first = state.queue[0];
  state.queue.shift();
  first.state = "leave";
  state.cash += first.value;
  state.dayStats.revenue += first.value;
  state.dayStats.customersServed += 1;
}

function manualCheckout() {
  if (state.phase !== "open" || state.employee.hired || !state.counter) return;
  const inZone = rectsOverlap(state.player, state.counter);
  if (!inZone) return setHint("Approche-toi du comptoir pour encaisser.");
  if (state.queue.length === 0) return;

  checkoutFirstClient();
  updateHud();
}

function updateSetupPhase(delta) {
  state.timer -= delta;
  movePlayer(delta);
  if (state.timer <= 0) {
    startDay();
  }
  updateHud();
}

function update(delta) {
  if (state.phase === "setup") {
    updateSetupPhase(delta);
  } else if (state.phase === "open") {
    updateOpenPhase(delta);
  }
}

function drawRect(x, y, w, h, fill, stroke = "#0f0920") {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawWorld() {
  drawRect(0, 0, canvas.width, canvas.height, "#1f1433");
  drawRect(20, 20, canvas.width - 40, canvas.height - 40, "#32204f", "#b493ff");
  drawRect(36, 58, canvas.width - 72, 42, "#4d356f", "#fbc75d");

  ctx.fillStyle = "#ffecb9";
  ctx.font = "16px monospace";
  ctx.fillText("VIDÉO CLUB - ENTRÉE CLIENTS", 52, 84);

  for (const shelf of state.shelves) {
    drawRect(shelf.x, shelf.y, shelf.w, shelf.h, "#4f3a79", "#fbc75d");
    drawRect(shelf.x + 6, shelf.y + 4, 12, 14, "#ff5f89");
    drawRect(shelf.x + 23, shelf.y + 4, 12, 14, "#59d8ff");
    drawRect(shelf.x + 40, shelf.y + 4, 12, 14, "#ffe067");
  }

  if (state.counter) {
    drawRect(state.counter.x, state.counter.y, state.counter.w, state.counter.h, "#6d4f9d", "#fbc75d");
    ctx.fillStyle = "#fff0cc";
    ctx.font = "13px monospace";
    ctx.fillText("CAISSE", state.counter.x + 20, state.counter.y + 23);
  }

  if (state.employee.hired && state.counter) {
    drawRect(state.counter.x + state.counter.w - 24, state.counter.y - 28, 18, 24, "#8effa2", "#194223");
  }

  for (const client of state.clients) {
    drawRect(client.x, client.y, client.w, client.h, "#9ff0ff", "#143744");
  }

  const p = state.player;
  drawRect(p.x, p.y, p.w, p.h, "#ff9762", "#39170a");
}

function drawOverlay() {
  if (state.phase !== "report" && state.phase !== "gameover") return;

  drawRect(200, 140, 560, 320, "#150f23", "#fbc75d");
  ctx.fillStyle = "#fbc75d";
  ctx.font = "24px monospace";
  const title = state.phase === "gameover" ? "BILAN FINAL" : `FIN DU JOUR ${state.report.day}`;
  ctx.fillText(title, 330, 188);

  const report = state.report;
  if (!report) return;

  ctx.font = "17px monospace";
  ctx.fillStyle = "#e5dbff";
  ctx.fillText(`Recettes: ${report.revenue}€`, 260, 240);
  ctx.fillText(`Dépenses: ${report.expenses}€`, 260, 276);
  ctx.fillText(`Profit: ${report.profit}€`, 260, 312);
  ctx.fillText(`Clients servis: ${report.served}`, 260, 348);
  ctx.fillText(`Clients perdus: ${report.lost}`, 260, 384);
  ctx.fillText(`Cash fin de journée: ${report.cashAfter}€`, 260, 420);

  ctx.fillStyle = "#ffd57d";
  ctx.font = "14px monospace";
  const action = state.phase === "gameover" ? "Clique Nouvelle partie" : "Clique Ouvrir plus tôt pour préparer le jour suivant";
  ctx.fillText(action, 235, 450);
}

function render() {
  drawWorld();
  drawOverlay();
}

locationButtonsWrap.addEventListener("click", (event) => {
  const btn = event.target.closest("button[data-location]");
  if (!btn) return;
  chooseLocation(btn.dataset.location);
});

placeShelfBtn.addEventListener("click", tryPlaceShelf);
placeCounterBtn.addEventListener("click", tryPlaceCounter);
hireEmployeeBtn.addEventListener("click", tryHireEmployee);
openNowBtn.addEventListener("click", () => {
  if (state.phase === "setup") startDay();
  else if (state.phase === "report") startNextSetup();
});
restartBtn.addEventListener("click", resetGame);

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
  if (event.code === "Space") {
    manualCheckout();
    event.preventDefault();
  }
  if (event.key.toLowerCase() === "e" && state.phase === "report") {
    startNextSetup();
  }
});

window.addEventListener("keyup", (event) => keys.delete(event.key));

let lastTs = performance.now();
function loop(ts) {
  const delta = Math.min(0.033, (ts - lastTs) / 1000);
  lastTs = ts;

  update(delta);
  render();
  requestAnimationFrame(loop);
}

resetGame();
requestAnimationFrame(loop);
