import { getSessions, getSession } from './api.js';
import { createSessionHeader } from './components/session-header.js';
import { createKpiCards } from './components/kpi-cards.js';
import { createLeaderboard } from './components/leaderboard.js';
import { createLapChart } from './components/lap-chart.js';
import { createContactSummary } from './components/contact-summary.js';
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

  const header = createSessionHeader(session, allSessions, onSelectSession);
  app.appendChild(header);

  const kpi = createKpiCards(session);
  app.appendChild(kpi);

  const main = document.createElement('main');
  main.className = 'dashboard__main';

  const leaderboard = createLeaderboard(session);
  main.appendChild(leaderboard);

  const rightPanel = document.createElement('div');
  rightPanel.className = 'dashboard__right';

  const lapChart = createLapChart(session);
  rightPanel.appendChild(lapChart);

  const contactSummary = createContactSummary(session);
  rightPanel.appendChild(contactSummary);

  main.appendChild(rightPanel);
  app.appendChild(main);

  const history = createSessionHistory(allSessions, onSelectSession);
  app.appendChild(history);
}

function onSelectSession(session) {
  currentSessionId = session.id;
  getSession(session.id).then(fullSession => renderSession(fullSession, currentSessions));
}

init();
