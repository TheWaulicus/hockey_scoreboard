// scoreboard.js: Logic for Hockey Scoreboard

// Theme toggle functionality
function toggleTheme() {
  const body = document.body;
  const currentTheme = body.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  
  body.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
  
  updateThemeIcons(newTheme);
  saveStateToFirestore();
}

function updateThemeIcons(theme) {
  const sunIcon = document.querySelector('.sun-icon');
  const moonIcon = document.querySelector('.moon-icon');
  
  if (theme === 'light') {
    sunIcon.classList.add('active');
    moonIcon.classList.remove('active');
  } else {
    sunIcon.classList.remove('active');
    moonIcon.classList.add('active');
  }
}

// Initialize theme on page load
function initializeTheme() {
  const currentTheme = document.body.getAttribute('data-theme') || 'dark';
  updateThemeIcons(currentTheme);
}

// Call initialize theme when DOM is loaded
document.addEventListener('DOMContentLoaded', initializeTheme);

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
  
  const oldScore = teamState[team][type];
  teamState[team][type] = Math.max(0, teamState[team][type] + delta);
  
  // If score increased, handle penalty release
  if (type === 'score' && delta > 0 && teamState[team][type] > oldScore) {
    onGoalScored(team);
  }
  
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

// Hockey Penalty System with Queueing
const penalties = { 
  A: { 
    serving: [], // Currently serving penalties (max 2)
    queue: []    // Waiting penalties
  }, 
  B: { 
    serving: [], // Currently serving penalties (max 2)
    queue: []    // Waiting penalties
  } 
};

const PENALTY_TYPES = {
  'Minor': { duration: 2, releasedOnGoal: true, maxServing: 2 },
  'Major': { duration: 5, releasedOnGoal: false, maxServing: 2 },
  'Misconduct': { duration: 10, releasedOnGoal: false, maxServing: 0 }, // Doesn't count toward on-ice strength
  'Game Misconduct': { duration: 'Game', releasedOnGoal: false, maxServing: 0 }
};

let penaltyTimers = { A: [], B: [] };

function renderPenalties(team) {
  const container = document.getElementById(`team${team}Penalties`);
  container.innerHTML = "";
  
  // Render serving penalties
  if (penalties[team].serving.length > 0) {
    const servingDiv = document.createElement("div");
    servingDiv.className = "penalty-section";
    servingDiv.innerHTML = "<h4>Serving:</h4>";
    
    penalties[team].serving.forEach((p, idx) => {
      const div = document.createElement("div");
      div.className = "penalty-row serving";
      const timeLeft = p.timeRemaining ? formatTime(p.timeRemaining) : 'Full';
      div.innerHTML = `
        <span class="penalty-info">#${p.number} - ${p.type} (${timeLeft})</span>
        ${p.reason ? `<span class="penalty-reason">${p.reason}</span>` : ''}
        <button class="penalty-remove" onclick="releasePenalty('${team}', ${idx}, 'serving')">&times;</button>
      `;
      servingDiv.appendChild(div);
    });
    container.appendChild(servingDiv);
  }
  
  // Render queued penalties
  if (penalties[team].queue.length > 0) {
    const queueDiv = document.createElement("div");
    queueDiv.className = "penalty-section";
    queueDiv.innerHTML = "<h4>Queue:</h4>";
    
    penalties[team].queue.forEach((p, idx) => {
      const div = document.createElement("div");
      div.className = "penalty-row queued";
      div.innerHTML = `
        <span class="penalty-info">#${p.number} - ${p.type}</span>
        ${p.reason ? `<span class="penalty-reason">${p.reason}</span>` : ''}
        <button class="penalty-remove" onclick="releasePenalty('${team}', ${idx}, 'queue')">&times;</button>
      `;
      queueDiv.appendChild(div);
    });
    container.appendChild(queueDiv);
  }
  
  updatePowerPlayStatus();
}

function formatTime(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

function showPenaltyForm(team) {
  document.getElementById(`team${team}PenaltyForm`).style.display = "flex";
}

function hidePenaltyForm(team) {
  document.getElementById(`team${team}PenaltyForm`).style.display = "none";
}

function addPenalty(team) {
  const num = document.getElementById(`team${team}PenaltyNumber`).value;
  const type = document.getElementById(`team${team}PenaltyType`).value;
  const reason = document.getElementById(`team${team}PenaltyReason`).value;
  
  if (!num || !type) return;
  
  const penaltyData = PENALTY_TYPES[type];
  const penalty = {
    number: parseInt(num),
    type: type,
    reason: reason,
    duration: penaltyData.duration,
    timeRemaining: penaltyData.duration === 'Game' ? null : penaltyData.duration * 60,
    releasedOnGoal: penaltyData.releasedOnGoal,
    startTime: Date.now()
  };
  
  // Determine if penalty goes to serving or queue
  const maxServing = getMaxServingPenalties(team);
  if (penalties[team].serving.length < maxServing && penaltyData.maxServing > 0) {
    penalties[team].serving.push(penalty);
    startPenaltyTimer(team, penalties[team].serving.length - 1);
  } else if (penaltyData.maxServing > 0) {
    penalties[team].queue.push(penalty);
  } else {
    // Misconduct penalties don't affect on-ice strength but are tracked
    penalties[team].queue.push(penalty);
  }
  
  renderPenalties(team);
  hidePenaltyForm(team);
  document.getElementById(`team${team}PenaltyForm`).reset();
  saveStateToFirestore();
}

function getMaxServingPenalties(team) {
  // In hockey, max 2 players can serve penalties simultaneously
  return 2;
}

function startPenaltyTimer(team, penaltyIndex) {
  const penalty = penalties[team].serving[penaltyIndex];
  if (!penalty || penalty.timeRemaining === null) return;
  
  const timerId = setInterval(() => {
    // Only count down if the main timer is running
    if (timerRunning && penalty.timeRemaining > 0) {
      penalty.timeRemaining--;
      renderPenalties(team);
      
      if (penalty.timeRemaining === 0) {
        clearInterval(timerId);
        releasePenalty(team, penaltyIndex, 'serving');
      }
    }
  }, 1000);
  
  // Store timer ID for cleanup
  if (!penaltyTimers[team]) penaltyTimers[team] = [];
  penaltyTimers[team][penaltyIndex] = timerId;
}

function releasePenalty(team, idx, location) {
  // Clear timer if releasing from serving
  if (location === 'serving' && penaltyTimers[team][idx]) {
    clearInterval(penaltyTimers[team][idx]);
    penaltyTimers[team][idx] = null;
  }
  
  // Remove penalty from specified location
  penalties[team][location].splice(idx, 1);
  
  // If releasing from serving, check queue for next penalty
  if (location === 'serving' && penalties[team].queue.length > 0) {
    // Move first queued penalty to serving
    const nextPenalty = penalties[team].queue.shift();
    if (PENALTY_TYPES[nextPenalty.type].maxServing > 0) {
      penalties[team].serving.push(nextPenalty);
      startPenaltyTimer(team, penalties[team].serving.length - 1);
    }
  }
  
  renderPenalties(team);
  saveStateToFirestore();
}

function getPowerPlayStatus() {
  const teamAServing = penalties.A.serving.length;
  const teamBServing = penalties.B.serving.length;
  
  let powerPlayStatus = '';
  if (teamAServing > teamBServing) {
    powerPlayStatus = `Team B Power Play (${teamAServing - teamBServing} man advantage)`;
  } else if (teamBServing > teamAServing) {
    powerPlayStatus = `Team A Power Play (${teamBServing - teamAServing} man advantage)`;
  } else if (teamAServing > 0 && teamBServing > 0) {
    powerPlayStatus = `${teamAServing}v${teamBServing}`;
  }
  
  return powerPlayStatus;
}

function updatePowerPlayStatus() {
  const powerPlayStatus = getPowerPlayStatus();
  
  // Update power play display
  const powerPlayElement = document.getElementById('powerPlayStatus');
  if (powerPlayElement) {
    powerPlayElement.textContent = powerPlayStatus;
    powerPlayElement.style.display = powerPlayStatus ? 'block' : 'none';
  }
}

function onGoalScored(team) {
  // Release minor penalties for opposing team when goal is scored
  const opposingTeam = team === 'A' ? 'B' : 'A';
  
  // Find first minor penalty that can be released on goal
  for (let i = 0; i < penalties[opposingTeam].serving.length; i++) {
    const penalty = penalties[opposingTeam].serving[i];
    if (penalty.releasedOnGoal) {
      releasePenalty(opposingTeam, i, 'serving');
      break; // Only release one penalty per goal
    }
  }
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
    timerRunning,
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
    lastUpdate: firebase.firestore.FieldValue.serverTimestamp(),
    powerPlayStatus: getPowerPlayStatus()
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
    timerRunning: false,
    period: 1,
    teamState: { A: { score: 0, shots: 0 }, B: { score: 0, shots: 0 } },
    penalties: { 
      A: { serving: [], queue: [] }, 
      B: { serving: [], queue: [] } 
    },
    leagueName: "League Name",
    teamAName: "Team A",
    teamBName: "Team B",
    leagueLogo: "",
    teamALogo: "",
    teamBLogo: "",
    timeouts: getDefaultTimeouts(),
    theme: "dark",
    gamePhase: "REG",
    lastUpdate: null,
    powerPlayStatus: ""
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
    // Initialize with default state if document doesn't exist
    const defaultState = getDefaultState();
    window.timeouts = defaultState.timeouts;
    renderTimeouts();
    SCOREBOARD_DOC.set(defaultState);
    return;
  }
  const state = doc.data();
  if (!isLocalUpdate) {
    // Timer state
    timerSeconds = state.timerSeconds || 20 * 60;
    
    // Handle timer running state - don't auto-restart timer from remote updates
    // to prevent conflicts between multiple clients
    if (state.timerRunning !== undefined && state.timerRunning !== timerRunning) {
      if (state.timerRunning && !timerRunning) {
        // Only start timer if it's not already running locally
        startTimer();
      } else if (!state.timerRunning && timerRunning) {
        // Stop timer if remote indicates it should be stopped
        stopTimer();
      }
    }
    
    period = state.period || 1;
    teamState.A = state.teamState?.A || { score: 0, shots: 0 };
    teamState.B = state.teamState?.B || { score: 0, shots: 0 };
    
    // Handle penalty data structure migration
    if (state.penalties) {
      if (Array.isArray(state.penalties.A)) {
        // Old format - migrate to new format
        penalties.A = { serving: state.penalties.A.slice(0, 2), queue: state.penalties.A.slice(2) };
        penalties.B = { serving: state.penalties.B.slice(0, 2), queue: state.penalties.B.slice(2) };
      } else {
        // New format
        penalties.A = state.penalties.A || { serving: [], queue: [] };
        penalties.B = state.penalties.B || { serving: [], queue: [] };
      }
    } else {
      penalties.A = { serving: [], queue: [] };
      penalties.B = { serving: [], queue: [] };
    }
    
    // Update UI elements
    document.getElementById("leagueName").textContent = state.leagueName || "League Name";
    document.getElementById("teamAName").textContent = state.teamAName || "Team A";
    document.getElementById("teamBName").textContent = state.teamBName || "Team B";
    
    // Handle logo URLs safely
    const leagueLogo = document.getElementById("leagueLogo");
    const teamALogo = document.getElementById("teamALogo");
    const teamBLogo = document.getElementById("teamBLogo");
    
    if (state.leagueLogo && state.leagueLogo !== leagueLogo.src) {
      leagueLogo.src = state.leagueLogo;
    }
    if (state.teamALogo && state.teamALogo !== teamALogo.src) {
      teamALogo.src = state.teamALogo;
    }
    if (state.teamBLogo && state.teamBLogo !== teamBLogo.src) {
      teamBLogo.src = state.teamBLogo;
    }
    
    // Timeouts
    window.timeouts =
      state.timeouts &&
      typeof state.timeouts.A === "number" &&
      typeof state.timeouts.B === "number"
        ? state.timeouts
        : getDefaultTimeouts();
    
    // Theme
    const newTheme = state.theme || "dark";
    if (document.body.dataset.theme !== newTheme) {
      document.body.dataset.theme = newTheme;
      initializeTheme();
    }
    
    // Game phase
    gamePhase = state.gamePhase || "REG";
    
    // Update all displays
    updateTimerDisplay();
    updatePhaseDisplay();
    document.getElementById("teamAScore").textContent = teamState.A.score;
    document.getElementById("teamBScore").textContent = teamState.B.score;
    document.getElementById("teamAShots").textContent = teamState.A.shots;
    document.getElementById("teamBShots").textContent = teamState.B.shots;
    
    // Restart penalty timers for serving penalties
    restartPenaltyTimers();
    
    renderPenalties("A");
    renderPenalties("B");
    renderTimeouts();
    updatePowerPlayStatus();
  }
  isLocalUpdate = false;
});

function restartPenaltyTimers() {
  // Clear existing timers
  ['A', 'B'].forEach(team => {
    if (penaltyTimers[team]) {
      penaltyTimers[team].forEach(timer => {
        if (timer) clearInterval(timer);
      });
    }
    penaltyTimers[team] = [];
  });
  
  // Restart timers for serving penalties
  ['A', 'B'].forEach(team => {
    penalties[team].serving.forEach((penalty, index) => {
      if (penalty.timeRemaining && penalty.timeRemaining > 0) {
        startPenaltyTimer(team, index);
      }
    });
  });
}

// Call saveStateToFirestore() after every state change (timer, score, period, penalties, settings, timeouts, theme)
// Call loadState() on window.onload

// Init
window.onload = function () {
  updateTimerDisplay();
  document.getElementById("teamAScore").textContent = teamState.A.score;
  document.getElementById("teamBScore").textContent = teamState.B.score;
  document.getElementById("teamAShots").textContent = teamState.A.shots;
  document.getElementById("teamBShots").textContent = teamState.B.shots;
  renderPenalties("A");
  renderPenalties("B");
  renderTimeouts();
  updatePhaseDisplay();
};
