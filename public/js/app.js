import { getSessions, getSession } from './api.js';
import { createSessionHeader } from './components/session-header.js';
import { createKpiCards } from './components/kpi-cards.js';
import { createLeaderboard } from './components/leaderboard.js';
import { createLapChart } from './components/lap-chart.js';
import { createPaceSummary } from './components/pace-summary.js';
import { createIncidentsPanel } from './components/incidents-panel.js';
import { createSessionHistory } from './components/session-history.js';
import { createLoadingState, createEmptyState, createErrorState } from './components/views.js';

const app = document.getElementById('app');
let currentSessions = [];
let currentSessionId = null;

async function init() {
  app.appendChild(createLoadingState());

  try {
    const sessions = await getSessions();
    currentSessions = sessions;

    if (sessions.length === 0) {
      app.innerHTML = '';
      app.appendChild(createEmptyState());
      return;
    }

    currentSessionId = sessions[0].id;
    const fullSession = await getSession(sessions[0].id);
    renderSession(fullSession, sessions);
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(createErrorState(err.message));
  }
}

async function renderSession(session, allSessions) {
  app.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'dashboard-shell';

  const header = createSessionHeader(session, allSessions, onSelectSession);
  shell.appendChild(header);

  const kpi = createKpiCards(session);
  shell.appendChild(kpi);

  const grid = document.createElement('div');
  grid.className = 'session-grid';

  const leaderboard = createLeaderboard(session);
  grid.appendChild(leaderboard);

  const rightPanel = document.createElement('div');
  rightPanel.className = 'session-grid__right';

  const lapChart = createLapChart(session);
  rightPanel.appendChild(lapChart);

  const paceSummary = createPaceSummary(session);
  rightPanel.appendChild(paceSummary);

  grid.appendChild(rightPanel);
  shell.appendChild(grid);

  const history = createSessionHistory(allSessions, onSelectSession, currentSessionId);
  shell.appendChild(history);

  const incidents = createIncidentsPanel(session);
  if (incidents) {
    shell.appendChild(incidents);
  }

  app.appendChild(shell);
}

function onSelectSession(session) {
  currentSessionId = session.id;
  getSession(session.id).then(fullSession => renderSession(fullSession, currentSessions));
}

init();
