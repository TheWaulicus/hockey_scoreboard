// scoreboard.js: Logic for Hockey Scoreboard

// Timer state
let timerInterval = null;
let timerSeconds = 20 * 60;
let timerRunning = false;
let period = 1;

// --- Overtime & Shootout Support ---
let gamePhase = "REG"; // 'REG', 'OT', 'SO'
const REGULATION_PERIODS = 3;

function updateTimerDisplay() {
  const min = String(Math.floor(timerSeconds / 60)).padStart(2, "0");
  const sec = String(timerSeconds % 60).padStart(2, "0");
  document.getElementById("timerDisplay").value = `${min}:${sec}`;
}

function startTimer() {
  if (timerRunning) return;
  timerRunning = true;
  timerInterval = setInterval(() => {
    if (timerSeconds > 0) {
      timerSeconds--;
      updateTimerDisplay();
      saveStateToFirestore();
    } else {
      stopTimer();
      saveStateToFirestore();
    }
  }, 1000);
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
  saveStateToFirestore();
}

function resetTimer() {
  stopTimer();
  timerSeconds = 20 * 60;
  updateTimerDisplay();
  saveStateToFirestore();
}

document.getElementById("timerDisplay").addEventListener("input", function (e) {
  const val = e.target.value.replace(/[^0-9:]/g, "");
  const [min, sec] = val.split(":");
  let m = parseInt(min, 10);
  let s = parseInt(sec, 10);
  if (isNaN(m)) m = 0;
  if (isNaN(s)) s = 0;
  timerSeconds = m * 60 + s;
  updateTimerDisplay();
  saveStateToFirestore();
});

function changePeriod(delta) {
  if (gamePhase !== "REG") return; // Only allow in regulation
  period = Math.max(1, period + delta);
  updatePhaseDisplay();
  saveStateToFirestore();
}

// Score and shots
const teamState = {
  A: { score: 0, shots: 0 },
  B: { score: 0, shots: 0 },
};

function updateScore(team, delta, type) {
  if (!["A", "B"].includes(team) || !["score", "shots"].includes(type)) return;
  teamState[team][type] = Math.max(0, teamState[team][type] + delta);
  document.getElementById(
    `team${team}${type.charAt(0).toUpperCase() + type.slice(1)}`
  ).textContent = teamState[team][type];
  saveStateToFirestore();
}

// Settings modal
function toggleSettings(show) {
  document.getElementById("settingsModal").style.display = show
    ? "flex"
    : "none";
}

function applySettings() {
  document.getElementById("leagueName").textContent =
    document.getElementById("leagueNameInput").value || "League Name";
  document.getElementById("teamAName").textContent =
    document.getElementById("teamANameInput").value || "Team A";
  document.getElementById("teamBName").textContent =
    document.getElementById("teamBNameInput").value || "Team B";
  // Logos
  const leagueLogoInput = document.getElementById("leagueLogoInput");
  if (leagueLogoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) =>
      (document.getElementById("leagueLogo").src = e.target.result);
    reader.readAsDataURL(leagueLogoInput.files[0]);
  }
  const teamALogoInput = document.getElementById("teamALogoInput");
  if (teamALogoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) =>
      (document.getElementById("teamALogo").src = e.target.result);
    reader.readAsDataURL(teamALogoInput.files[0]);
  }
  const teamBLogoInput = document.getElementById("teamBLogoInput");
  if (teamBLogoInput.files[0]) {
    const reader = new FileReader();
    reader.onload = (e) =>
      (document.getElementById("teamBLogo").src = e.target.result);
    reader.readAsDataURL(teamBLogoInput.files[0]);
  }
  toggleSettings(false);
  saveStateToFirestore();
}

// Penalties
const penalties = { A: [], B: [] };

function renderPenalties(team) {
  const container = document.getElementById(`team${team}Penalties`);
  container.innerHTML = "";
  penalties[team].forEach((p, idx) => {
    const div = document.createElement("div");
    div.className = "penalty-row";
    div.innerHTML = `#${p.number} - ${p.minutes} min${
      p.reason ? " (" + p.reason + ")" : ""
    } <button onclick="removePenalty('${team}',${idx})">&times;</button>`;
    container.appendChild(div);
  });
}

function showPenaltyForm(team) {
  document.getElementById(`team${team}PenaltyForm`).style.display = "flex";
}

function hidePenaltyForm(team) {
  document.getElementById(`team${team}PenaltyForm`).style.display = "none";
}

function addPenalty(team) {
  const num = document.getElementById(`team${team}PenaltyNumber`).value;
  const min = document.getElementById(`team${team}PenaltyMinutes`).value;
  const reason = document.getElementById(`team${team}PenaltyReason`).value;
  if (!num || !min) return;
  penalties[team].push({ number: num, minutes: min, reason });
  renderPenalties(team);
  hidePenaltyForm(team);
  document.getElementById(`team${team}PenaltyForm`).reset();
  saveStateToFirestore();
}

function removePenalty(team, idx) {
  penalties[team].splice(idx, 1);
  renderPenalties(team);
  saveStateToFirestore();
}

// --- Persistence ---
const STORAGE_KEY = "hockeyScoreboardState";

function updatePhaseDisplay() {
  let label = "";
  if (gamePhase === "REG") label = `Period ${period}`;
  else if (gamePhase === "OT") label = "Overtime";
  else if (gamePhase === "SO") label = "Shootout";
  document.getElementById("periodLabel").textContent = label;
}

function advancePhase() {
  if (gamePhase === "REG" && period < REGULATION_PERIODS) {
    changePeriod(1);
  } else if (gamePhase === "REG" && period === REGULATION_PERIODS) {
    gamePhase = "OT";
    period = "OT";
    updatePhaseDisplay();
    saveStateToFirestore();
  } else if (gamePhase === "OT") {
    gamePhase = "SO";
    period = "SO";
    updatePhaseDisplay();
    saveStateToFirestore();
  }
}

function resetPhase() {
  gamePhase = "REG";
  period = 1;
  updatePhaseDisplay();
  saveStateToFirestore();
}

function saveStateToFirestore() {
  const state = {
    timerSeconds,
    period,
    teamState,
    penalties,
    leagueName: document.getElementById("leagueName").textContent,
    teamAName: document.getElementById("teamAName").textContent,
    teamBName: document.getElementById("teamBName").textContent,
    leagueLogo: document.getElementById("leagueLogo").src,
    teamALogo: document.getElementById("teamALogo").src,
    teamBLogo: document.getElementById("teamBLogo").src,
    timeouts: window.timeouts || { A: 0, B: 0 },
    theme: document.body.dataset.theme || "dark",
    gamePhase,
  };
  isLocalUpdate = true;
  SCOREBOARD_DOC.set(state);
}

function getDefaultTimeouts() {
  return { A: 0, B: 0 };
}

function getDefaultState() {
  return {
    timerSeconds: 20 * 60,
    period: 1,
    teamState: { A: { score: 0, shots: 0 }, B: { score: 0, shots: 0 } },
    penalties: { A: [], B: [] },
    leagueName: "League Name",
    teamAName: "Team A",
    teamBName: "Team B",
    leagueLogo: "",
    teamALogo: "",
    teamBLogo: "",
    timeouts: getDefaultTimeouts(),
    theme: "dark",
    gamePhase: "REG",
  };
}

function resetAll() {
  SCOREBOARD_DOC.set(getDefaultState()).then(() => {
    window.location.reload();
  });
}

function renderTimeouts() {
  document.getElementById("teamATimeouts").textContent = window.timeouts.A;
  document.getElementById("teamBTimeouts").textContent = window.timeouts.B;
}

function changeTimeout(team, delta) {
  if (!["A", "B"].includes(team)) return;
  window.timeouts[team] = Math.max(0, window.timeouts[team] + delta);
  renderTimeouts();
  saveStateToFirestore();
}

// --- Firestore Sync ---
const SCOREBOARD_DOC = db.collection("scoreboards").doc("main");
let isLocalUpdate = false;

SCOREBOARD_DOC.onSnapshot((doc) => {
  if (!doc.exists) {
    window.timeouts = getDefaultTimeouts();
    renderTimeouts();
    return;
  }
  const state = doc.data();
  if (!isLocalUpdate) {
    timerSeconds = state.timerSeconds;
    period = state.period;
    teamState.A = state.teamState.A;
    teamState.B = state.teamState.B;
    penalties.A = state.penalties.A;
    penalties.B = state.penalties.B;
    document.getElementById("leagueName").textContent = state.leagueName;
    document.getElementById("teamAName").textContent = state.teamAName;
    document.getElementById("teamBName").textContent = state.teamBName;
    document.getElementById("leagueLogo").src = state.leagueLogo;
    document.getElementById("teamALogo").src = state.teamALogo;
    document.getElementById("teamBLogo").src = state.teamBLogo;
    window.timeouts =
      state.timeouts &&
      typeof state.timeouts.A === "number" &&
      typeof state.timeouts.B === "number"
        ? state.timeouts
        : getDefaultTimeouts();
    document.body.dataset.theme = state.theme;
    gamePhase = state.gamePhase || "REG";
    updateTimerDisplay();
    updatePhaseDisplay();
    document.getElementById("teamAScore").textContent = teamState.A.score;
    document.getElementById("teamBScore").textContent = teamState.B.score;
    document.getElementById("teamAShots").textContent = teamState.A.shots;
    document.getElementById("teamBShots").textContent = teamState.B.shots;
    renderPenalties("A");
    renderPenalties("B");
    renderTimeouts();
    updateTheme();
  }
  isLocalUpdate = false;
});

// Call saveStateToFirestore() after every state change (timer, score, period, penalties, settings, timeouts, theme)
// Call loadState() on window.onload

// Init
window.onload = function () {
  loadState();
  updateTimerDisplay();
  document.getElementById("periodValue").textContent = period;
  document.getElementById("teamAScore").textContent = teamState.A.score;
  document.getElementById("teamBScore").textContent = teamState.B.score;
  document.getElementById("teamAShots").textContent = teamState.A.shots;
  document.getElementById("teamBShots").textContent = teamState.B.shots;
  renderPenalties("A");
  renderPenalties("B");
  renderTimeouts();
};
