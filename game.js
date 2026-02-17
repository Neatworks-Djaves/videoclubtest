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

const controlsToggleBtn = document.getElementById("controlsToggle");
const controlsPanel = document.getElementById("controlsPanel");
const startGameBtn = document.getElementById("startGame");
const restartBtn = document.getElementById("restart");
const locationButtonsWrap = document.getElementById("locationButtons");
const placeShelfBtn = document.getElementById("placeShelf");
const placeCounterBtn = document.getElementById("placeCounter");
const hireEmployeeBtn = document.getElementById("hireEmployee");
const openNowBtn = document.getElementById("openNow");
const locationBox = document.getElementById("locationBox");
const setupBox = document.getElementById("setupBox");

const keys = new Set();
const LOCATION_DATA = {
  centre: { name: "Centre-ville", rent: 180, traffic: 1.45, startCash: 1200 },
  residentiel: { name: "Résidentiel", rent: 120, traffic: 1.0, startCash: 1000 },
  banlieue: { name: "Banlieue", rent: 70, traffic: 0.7, startCash: 920 },
};

const SHELF_COST = 120;
const COUNTER_COST = 220;
const EMPLOYEE_DAILY_COST = 80;
const SETUP_TIME = 50;
const DAY_TIME = 75;

const MOVIE_GENRES = [
  { name: "Action", color: "#ff5d88", priceMin: 8, priceMax: 13 },
  { name: "Horreur", color: "#9dff6f", priceMin: 7, priceMax: 12 },
  { name: "Sci-Fi", color: "#63ddff", priceMin: 9, priceMax: 14 },
  { name: "Comédie", color: "#ffe06f", priceMin: 6, priceMax: 11 },
  { name: "Drame", color: "#c59bff", priceMin: 7, priceMax: 12 },
];

let state;

function resetGame() {
  state = {
    phase: "title",
    selectedLocation: null,
    day: 0,
    timer: 0,
    cash: 0,
    inventory: 0,
    employee: { hired: false },
    player: { x: 95, y: 520, w: 24, h: 24, speed: 185 },
    shelves: [],
    counter: null,
    selectedObject: null,
    draggingObject: false,
    clients: [],
    queue: [],
    spawnAccumulator: 0,
    dayStats: { revenue: 0, expenses: 0, customersServed: 0, customersLost: 0 },
    report: null,
    gameOver: false,
  };
  setHint('Clique "Commencer" pour démarrer.');
  updateHud();
  updateControls();
}

function setHint(text) {
  hintEl.textContent = text;
}

function startFlow() {
  if (state.phase !== "title") return;
  state.phase = "location";
  setHint("Choisis un quartier sur le panneau de gauche.");
  updateHud();
  updateControls();
}

function chooseLocation(id) {
  if (state.phase !== "location") return;
  const location = LOCATION_DATA[id];
  if (!location) return;

  state.selectedLocation = { id, ...location };
  state.cash = location.startCash;
  state.phase = "setup";
  state.timer = SETUP_TIME;
  setHint("Installation: place objets, puis E pour sélectionner, M pour déplacer, R pour tourner.");
  updateHud();
  updateControls();
}

function createObject(type, x, y) {
  if (type === "shelf") {
    return { type, x, y, w: 66, h: 24, rotation: 0 };
  }
  return { type: "counter", x, y, w: 106, h: 36, rotation: 0 };
}

function tryPlaceShelf() {
  if (state.phase !== "setup" || state.cash < SHELF_COST) {
    if (state.phase === "setup") setHint("Pas assez d'argent pour une étagère.");
    return;
  }

  const obj = createObject("shelf", Math.round(state.player.x - 14), Math.round(state.player.y - 18));
  state.shelves.push(obj);
  state.cash -= SHELF_COST;
  state.inventory += 8;
  setHint("Étagère placée. Tu peux la sélectionner puis la déplacer/tourner.");
  updateHud();
}

function tryPlaceCounter() {
  if (state.phase !== "setup") return;
  if (state.counter) return setHint("Comptoir déjà posé.");
  if (state.cash < COUNTER_COST) return setHint("Pas assez d'argent pour le comptoir.");

  state.counter = createObject("counter", Math.round(state.player.x - 26), Math.round(state.player.y - 16));
  state.cash -= COUNTER_COST;
  setHint("Comptoir posé. Engage un employé ou tiens la caisse toi-même.");
  updateHud();
  updateControls();
}

function tryHireEmployee() {
  if (state.phase !== "setup") return;
  if (!state.counter) return setHint("Pose d'abord le comptoir.");
  if (state.employee.hired) return setHint("Employé déjà engagé.");

  state.employee.hired = true;
  setHint("Employé engagé: caisse automatique pendant la journée.");
}

function startDay() {
  if (state.phase !== "setup") return;
  if (!state.counter || state.shelves.length === 0) return setHint("Besoin d'1 comptoir + 1 étagère minimum.");

  state.phase = "open";
  state.day += 1;
  state.timer = DAY_TIME;
  state.selectedObject = null;
  state.draggingObject = false;
  state.clients = [];
  state.queue = [];
  state.spawnAccumulator = 0;
  state.dayStats = { revenue: 0, expenses: 0, customersServed: 0, customersLost: 0 };
  setHint("Ouverture! Les clients prennent un film et paient au comptoir.");
  updateHud();
  updateControls();
}

function closeDay() {
  const rent = state.selectedLocation.rent;
  const salary = state.employee.hired ? EMPLOYEE_DAILY_COST : 0;
  const refillCost = Math.max(20, Math.floor(state.shelves.length * 7));
  const expenses = rent + salary + refillCost;

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
    setHint("Cash négatif. Tu as fait faillite.");
  } else {
    state.phase = "report";
    setHint("Bilan de journée terminé. Clique Ouvrir plus tôt pour préparer le jour suivant.");
  }

  state.timer = 0;
  state.clients = [];
  state.queue = [];
  updateHud();
  updateControls();
}

function startNextSetup() {
  if (state.phase !== "report") return;
  state.phase = "setup";
  state.timer = SETUP_TIME;
  state.report = null;
  setHint("Nouvelle installation: optimise ton aménagement.");
  updateHud();
  updateControls();
}

function updateHud() {
  const phaseNames = {
    title: "Accueil",
    location: "Choix du quartier",
    setup: "Installation",
    open: "Ouvert",
    report: "Bilan de journée",
    gameover: "Faillite",
  };

  phaseEl.textContent = `Phase: ${phaseNames[state.phase]}`;
  dayEl.textContent = `Jour: ${state.day}`;
  cashEl.textContent = `Cash: $${Math.floor(state.cash)}`;
  timerEl.textContent = `Temps: ${Math.max(0, Math.ceil(state.timer))}s`;
  rentEl.textContent = `Loyer: $${state.selectedLocation ? state.selectedLocation.rent : 0} / jour`;
  trafficEl.textContent = `Passage: ${state.selectedLocation ? state.selectedLocation.name : "-"}`;
  inventoryEl.textContent = `Films en stock: ${Math.max(0, state.inventory)}`;
}

function updateControls() {
  const onTitle = state.phase === "title";
  const onLocation = state.phase === "location";
  const onSetup = state.phase === "setup";

  startGameBtn.disabled = !onTitle;
  locationBox.classList.toggle("hidden", !onLocation);
  setupBox.classList.toggle("hidden", !onSetup && state.phase !== "report");

  [...locationButtonsWrap.querySelectorAll("button")].forEach((btn) => {
    btn.disabled = !onLocation;
  });

  placeShelfBtn.disabled = !onSetup;
  placeCounterBtn.disabled = !onSetup;
  hireEmployeeBtn.disabled = !onSetup;
  openNowBtn.disabled = !(onSetup || state.phase === "report");
  openNowBtn.textContent = state.phase === "report" ? "Continuer" : "Ouvrir plus tôt";
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function getAllObjects() {
  const all = [...state.shelves];
  if (state.counter) all.push(state.counter);
  return all;
}

function objectDistanceToPlayer(obj) {
  const ox = obj.x + obj.w / 2;
  const oy = obj.y + obj.h / 2;
  const px = state.player.x + state.player.w / 2;
  const py = state.player.y + state.player.h / 2;
  return Math.hypot(ox - px, oy - py);
}

function selectNearbyObject() {
  if (state.phase !== "setup") return;
  const candidates = getAllObjects().filter((obj) => objectDistanceToPlayer(obj) < 90);
  if (candidates.length === 0) {
    state.selectedObject = null;
    state.draggingObject = false;
    return setHint("Aucun objet proche à sélectionner.");
  }
  candidates.sort((a, b) => objectDistanceToPlayer(a) - objectDistanceToPlayer(b));
  state.selectedObject = candidates[0];
  setHint(`${state.selectedObject.type === "counter" ? "Comptoir" : "Étagère"} sélectionné.`);
}

function rotateSelectedObject() {
  if (state.phase !== "setup" || !state.selectedObject) return;
  const obj = state.selectedObject;
  const oldW = obj.w;
  obj.w = obj.h;
  obj.h = oldW;
  obj.rotation = (obj.rotation + 90) % 180;
  setHint("Objet tourné.");
}

function toggleMoveSelectedObject() {
  if (state.phase !== "setup" || !state.selectedObject) return;
  state.draggingObject = !state.draggingObject;
  setHint(state.draggingObject ? "Mode déplacement actif: l'objet suit ton personnage." : "Objet déposé.");
}

function movePlayer(delta) {
  const p = state.player;
  let dx = 0;
  let dy = 0;

  if (keys.has("ArrowUp") || keys.has("w") || keys.has("z")) dy -= 1;
  if (keys.has("ArrowDown") || keys.has("s")) dy += 1;
  if (keys.has("ArrowLeft") || keys.has("a") || keys.has("q")) dx -= 1;
  if (keys.has("ArrowRight") || keys.has("d")) dx += 1;

  if (dx || dy) {
    const norm = Math.hypot(dx, dy) || 1;
    p.x += (dx / norm) * p.speed * delta;
    p.y += (dy / norm) * p.speed * delta;
  }

  p.x = Math.max(18, Math.min(canvas.width - p.w - 18, p.x));
  p.y = Math.max(58, Math.min(canvas.height - p.h - 18, p.y));

  if (state.phase === "setup" && state.draggingObject && state.selectedObject) {
    state.selectedObject.x = Math.round(p.x + p.w + 8);
    state.selectedObject.y = Math.round(p.y);
  }
}

function pickRandomGenre() {
  return MOVIE_GENRES[Math.floor(Math.random() * MOVIE_GENRES.length)];
}

function spawnClient() {
  const available = state.shelves.length > 0 && state.inventory > 0;
  const genre = pickRandomGenre();
  const valueRange = genre.priceMax - genre.priceMin + 1;
  const value = genre.priceMin + Math.floor(Math.random() * valueRange);

  state.clients.push({
    x: 30,
    y: 100 + Math.random() * 440,
    w: 20,
    h: 20,
    speed: 40 + Math.random() * 18,
    state: available ? "browse" : "leave",
    browseTimer: 2 + Math.random() * 3,
    patience: 12 + Math.random() * 8,
    value,
    genre,
    hasMovie: false,
  });
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
  if (!rectsOverlap(state.player, state.counter)) return setHint("Approche-toi du comptoir pour encaisser.");
  checkoutFirstClient();
  updateHud();
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
      const targetX = state.counter ? state.counter.x - 35 - spotIndex * 24 : 110;
      const targetY = state.counter ? state.counter.y + 8 : 180;
      client.x += Math.sign(targetX - client.x) * client.speed * delta;
      client.y += Math.sign(targetY - client.y) * client.speed * delta;

      if (state.employee.hired && spotIndex === 0) checkoutFirstClient();
    } else {
      client.x += client.speed * delta;
    }

    if (client.patience <= 0 && client.state !== "leave") {
      client.state = "leave";
      const idx = state.queue.indexOf(client);
      if (idx >= 0) state.queue.splice(idx, 1);
      state.dayStats.customersLost += 1;
    }
  }

  state.clients = state.clients.filter((c) => c.x < canvas.width + 45);
  if (state.timer <= 0) closeDay();
  updateHud();
}

function updateSetupPhase(delta) {
  state.timer -= delta;
  movePlayer(delta);
  if (state.timer <= 0) startDay();
  updateHud();
}

function update(delta) {
  if (state.phase === "setup") updateSetupPhase(delta);
  if (state.phase === "open") updateOpenPhase(delta);
}

function drawRect(x, y, w, h, fill, stroke = "#100a20") {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.strokeRect(x, y, w, h);
}

function drawFloor() {
  drawRect(0, 0, canvas.width, canvas.height, "#201438");
  drawRect(20, 20, canvas.width - 40, canvas.height - 40, "#311f4e", "#af8ef9");

  for (let y = 110; y < canvas.height - 30; y += 36) {
    for (let x = 40; x < canvas.width - 30; x += 36) {
      drawRect(x, y, 30, 30, (x + y) % 72 === 0 ? "#3a275b" : "#342251", "#2b1b44");
    }
  }

  drawRect(32, 58, canvas.width - 64, 40, "#4f3772", "#ffce6e");
  ctx.fillStyle = "#fff2cb";
  ctx.font = "16px monospace";
  ctx.fillText("RETRO VIDEO CLUB", 50, 84);

  ctx.font = "11px monospace";
  ctx.fillStyle = "#e7dcff";
  ctx.fillText("Genres:", canvas.width - 320, 82);
  let gx = canvas.width - 255;
  for (const genre of MOVIE_GENRES) {
    drawRect(gx, 72, 10, 10, genre.color, "#1a122b");
    gx += 14;
  }
}


function drawTitleScreen() {
  drawFloor();
  drawRect(220, 180, 560, 250, "#150f24", "#ffce6e");
  ctx.fillStyle = "#ffce6e";
  ctx.font = "34px monospace";
  ctx.fillText("VIDEO CLUB SIM", 290, 250);
  ctx.font = "17px monospace";
  ctx.fillStyle = "#e8dcff";
  ctx.fillText("Gère ton club: loyer, stock, caisse", 292, 302);
  ctx.fillText("et clients du matin au soir.", 332, 332);
  ctx.fillStyle = "#ffd97d";
  ctx.fillText("Clique 'Commencer' ou appuie sur Entrée", 258, 385);
}

function drawLocationScreen() {
  drawFloor();
  drawRect(210, 160, 580, 300, "#160f27", "#ffce6e");
  ctx.fillStyle = "#ffce6e";
  ctx.font = "24px monospace";
  ctx.fillText("CHOIX DU QUARTIER", 328, 218);
  ctx.font = "16px monospace";
  ctx.fillStyle = "#e8dcff";
  ctx.fillText("Centre-ville: +clients / +loyer", 285, 272);
  ctx.fillText("Résidentiel: équilibré", 285, 308);
  ctx.fillText("Banlieue: -clients / -loyer", 285, 344);
  ctx.fillStyle = "#ffd97d";
  ctx.fillText("Choisis à gauche pour entrer en phase d'installation", 225, 406);
}

function drawObjectsAndActors() {
  for (const shelf of state.shelves) {
    const selected = shelf === state.selectedObject;
    drawRect(shelf.x, shelf.y, shelf.w, shelf.h, selected ? "#7a5cb4" : "#563f82", selected ? "#86ff8a" : "#ffce6e");
    drawRect(shelf.x + 6, shelf.y + 4, 12, Math.max(10, shelf.h - 10), "#ff5d88");
    drawRect(shelf.x + 24, shelf.y + 4, 12, Math.max(10, shelf.h - 10), "#63ddff");
    drawRect(shelf.x + 42, shelf.y + 4, 12, Math.max(10, shelf.h - 10), "#ffe06f");
  }

  if (state.counter) {
    const selected = state.counter === state.selectedObject;
    drawRect(
      state.counter.x,
      state.counter.y,
      state.counter.w,
      state.counter.h,
      selected ? "#8360ba" : "#6b4d9c",
      selected ? "#86ff8a" : "#ffce6e"
    );
    ctx.fillStyle = "#fff1cd";
    ctx.font = "13px monospace";
    ctx.fillText("CAISSE", state.counter.x + 20, state.counter.y + Math.max(21, state.counter.h / 2 + 6));
  }

  if (state.employee.hired && state.counter) {
    drawRect(state.counter.x + state.counter.w - 24, state.counter.y - 27, 18, 24, "#94ffad", "#1f492a");
  }

  for (const client of state.clients) {
    drawCustomer(client);
  }

  drawRect(state.player.x, state.player.y, state.player.w, state.player.h, "#ffa36f", "#3f1a0b");
}

function drawCustomer(client) {
  const cx = client.x + client.w / 2;
  const cy = client.y + client.h / 2;

  // tête
  drawRect(cx - 5, cy - 13, 10, 9, "#ffd6b3", "#6f4127");
  // corps
  drawRect(cx - 6, cy - 4, 12, 11, "#8ec8ff", "#21486d");
  // jambes
  drawRect(cx - 5, cy + 7, 4, 8, "#40355f", "#241a3e");
  drawRect(cx + 1, cy + 7, 4, 8, "#40355f", "#241a3e");
  // bras
  drawRect(cx - 10, cy - 3, 4, 8, "#ffd6b3", "#6f4127");
  drawRect(cx + 6, cy - 3, 4, 8, "#ffd6b3", "#6f4127");

  if (client.hasMovie) {
    // cassette VHS dans la main droite
    drawRect(cx + 10, cy - 1, 8, 5, client.genre.color, "#120d1d");
    drawRect(cx + 12, cy, 2, 3, "#efe9ff", "#120d1d");
  }
}

function drawReportOverlay() {
  if (state.phase !== "report" && state.phase !== "gameover") return;

  drawRect(210, 145, 580, 340, "#150f24", "#ffce6e");
  const report = state.report;
  if (!report) return;

  ctx.fillStyle = "#ffce6e";
  ctx.font = "24px monospace";
  ctx.fillText(state.phase === "gameover" ? "BILAN FINAL" : `FIN DU JOUR ${report.day}`, 355, 195);

  ctx.font = "17px monospace";
  ctx.fillStyle = "#ece2ff";
  ctx.fillText(`Recettes: $${report.revenue}`, 280, 245);
  ctx.fillText(`Dépenses: $${report.expenses}`, 280, 281);
  ctx.fillText(`Profit: $${report.profit}`, 280, 317);
  ctx.fillText(`Clients servis: ${report.served}`, 280, 353);
  ctx.fillText(`Clients perdus: ${report.lost}`, 280, 389);
  ctx.fillText(`Cash de fin: $${report.cashAfter}`, 280, 425);

  ctx.fillStyle = "#ffd97d";
  ctx.font = "14px monospace";
  ctx.fillText(
    state.phase === "gameover" ? "Clique Nouvelle partie" : "Clique Ouvrir plus tôt pour la prochaine journée",
    250,
    462
  );
}

function render() {
  if (state.phase === "title") return drawTitleScreen();
  if (state.phase === "location") return drawLocationScreen();

  drawFloor();
  drawObjectsAndActors();
  drawReportOverlay();
}

controlsToggleBtn.addEventListener("click", () => {
  controlsPanel.classList.toggle("hidden");
});

startGameBtn.addEventListener("click", startFlow);
restartBtn.addEventListener("click", resetGame);

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

window.addEventListener("keydown", (event) => {
  keys.add(event.key);

  const lower = event.key.toLowerCase();
  if (event.code === "Space") {
    manualCheckout();
    event.preventDefault();
  }
  if (event.key === "Enter") startFlow();
  if (lower === "e") {
    if (state.selectedObject) {
      state.selectedObject = null;
      state.draggingObject = false;
      setHint("Objet désélectionné.");
    } else {
      selectNearbyObject();
    }
  }
  if (lower === "r") rotateSelectedObject();
  if (lower === "m") toggleMoveSelectedObject();
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
