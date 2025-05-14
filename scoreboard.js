// scoreboard.js: Logic for Hockey Scoreboard

// Timer state
let timerInterval = null;
let timerSeconds = 20 * 60;
let timerRunning = false;
let period = 1;

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
    } else {
      stopTimer();
    }
  }, 1000);
}

function stopTimer() {
  timerRunning = false;
  clearInterval(timerInterval);
}

function resetTimer() {
  stopTimer();
  timerSeconds = 20 * 60;
  updateTimerDisplay();
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
});

function changePeriod(delta) {
  period = Math.max(1, period + delta);
  document.getElementById("periodValue").textContent = period;
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
}

function removePenalty(team, idx) {
  penalties[team].splice(idx, 1);
  renderPenalties(team);
}

// Init
window.onload = function () {
  updateTimerDisplay();
  document.getElementById("periodValue").textContent = period;
  document.getElementById("teamAScore").textContent = teamState.A.score;
  document.getElementById("teamBScore").textContent = teamState.B.score;
  document.getElementById("teamAShots").textContent = teamState.A.shots;
  document.getElementById("teamBShots").textContent = teamState.B.shots;
  renderPenalties("A");
  renderPenalties("B");
};
