import { getSessions, getSession, getTracks, getClubStats, getClubRecords, getCarRecords, getRecentSessions, getTrackRecords, getCarDrillDown, getDriverDrillDown } from './api.js';
import { createSessionHeader } from './components/session-header.js';
import { createKpiCards } from './components/kpi-cards.js';
import { createLeaderboard } from './components/leaderboard.js';
import { createLapChart } from './components/lap-chart.js';
import { createPaceSummary } from './components/pace-summary.js';
import { createIncidentsPanel } from './components/incidents-panel.js';
import { createSessionHistory } from './components/session-history.js';
import { createLoadingState, createEmptyState, createErrorState } from './components/views.js';
import { createClubOverview } from './components/club-overview.js';
import { createRecordsPanel, createCarRecordsPanel } from './components/records-panel.js';
import { createTrackSelector } from './components/track-selector.js';
import { formatTime, formatDateTime } from './formatters.js';

const app = document.getElementById('app');
let currentSessions = [];
let currentSessionId = null;
let currentTracks = [];
let currentClubStats = null;
let currentRecords = [];
let currentCarRecords = [];
let selectedTrack = null;
let selectedLayout = null;

function parseRoute() {
  const hash = window.location.hash || '#/';
  if (hash.startsWith('#/session/')) {
    return { view: 'session', id: hash.slice('#/session/'.length) };
  }
  if (hash.startsWith('#/tracks/')) {
    return { view: 'track', id: hash.slice('#/tracks/'.length) };
  }
  if (hash.startsWith('#/cars/')) {
    return { view: 'car', id: hash.slice('#/cars/'.length) };
  }
  if (hash.startsWith('#/drivers/')) {
    return { view: 'driver', id: hash.slice('#/drivers/'.length) };
  }
  if (hash === '#/' || hash === '#') {
    return { view: 'club' };
  }
  if (hash.startsWith('#/')) {
    const trackPart = hash.slice(2);
    if (trackPart.includes('|')) {
      return { view: 'track', id: trackPart };
    }
  }
  return { view: 'club' };
}

async function init() {
  app.appendChild(createLoadingState());

  try {
    const [sessionsRes, tracksRes, statsRes] = await Promise.all([
      getSessions(),
      getTracks(),
      getClubStats(),
    ]);

    currentSessions = sessionsRes;
    currentTracks = tracksRes.tracks || [];
    currentClubStats = statsRes;

    if (currentSessions.length === 0) {
      app.innerHTML = '';
      app.appendChild(createEmptyState());
      return;
    }

    const route = parseRoute();
    if (route.view === 'session' && route.id) {
      const session = currentSessions.find(s => s.id === route.id);
      if (session) {
        const fullSession = await getSession(session.id);
        renderSession(fullSession, currentSessions);
        return;
      }
    }

    if (route.view === 'track' && route.id) {
      const decoded = decodeURIComponent(route.id);
      const sep = decoded.indexOf('|');
      if (sep !== -1) {
        selectedTrack = decoded.slice(0, sep);
        selectedLayout = decoded.slice(sep + 1);
        await loadClubData();
        renderClub();
        return;
      }
    }

    if (route.view === 'car' && route.id) {
      await renderCarDrillDown(decodeURIComponent(route.id));
      return;
    }

    if (route.view === 'driver' && route.id) {
      await renderDriverDrillDown(decodeURIComponent(route.id));
      return;
    }

    await loadClubData();
    renderClub();
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(createErrorState(err.message));
  }
}

async function loadClubData() {
  const trackName = selectedTrack;
  const layout = selectedLayout;
  if (!trackName || !layout) {
    currentRecords = [];
    currentCarRecords = [];
    return;
  }
  try {
    const [recordsRes, carRecordsRes] = await Promise.all([
      getClubRecords(trackName, layout),
      getCarRecords(trackName, layout),
    ]);
    currentRecords = recordsRes.records || [];
    currentCarRecords = carRecordsRes.records || [];
  } catch {
    currentRecords = [];
    currentCarRecords = [];
  }
}

function renderClub() {
  app.innerHTML = '';

  const shell = document.createElement('div');
  shell.className = 'dashboard-shell';

  const appBar = document.createElement('div');
  appBar.className = 'app-bar';

  const brand = document.createElement('h1');
  brand.className = 'app-bar__brand';
  brand.style.cursor = 'pointer';
  brand.textContent = 'BENTOCLUB';
  brand.addEventListener('click', () => {
    selectedTrack = null;
    selectedLayout = null;
    window.location.hash = '#/';
    loadClubData().then(() => renderClub());
  });

  const status = document.createElement('span');
  status.className = 'app-bar__status';
  status.textContent = `${currentClubStats?.totalSessions || 0} sessions`;
  appBar.appendChild(brand);
  appBar.appendChild(status);
  shell.appendChild(appBar);

  const overviewContent = document.createElement('div');
  overviewContent.className = 'club-overview-content';

  const trackSelector = createTrackSelector(
    currentTracks,
    selectedTrack,
    selectedLayout,
    (track, layout) => {
      selectedTrack = track;
      selectedLayout = layout;
      window.location.hash = track && layout ? `#/${encodeURIComponent(track)}|${encodeURIComponent(layout)}` : '#/';
      loadClubData().then(() => renderClub());
    }
  );
  overviewContent.appendChild(trackSelector);

  if (selectedTrack && selectedLayout) {
    const recordsPanel = createRecordsPanel(currentRecords, selectedTrack, selectedLayout);
    overviewContent.appendChild(recordsPanel);

    if (currentCarRecords.length > 0) {
      const carRecordsPanel = createCarRecordsPanel(currentCarRecords, currentRecords[0]?.bestLapMs);
      overviewContent.appendChild(carRecordsPanel);
    }

    if (currentSessions.length > 0) {
      const history = createSessionHistory(currentSessions, onSelectSession, currentSessionId);
      overviewContent.appendChild(history);
    }
  } else {
    createClubOverview(overviewContent, currentClubStats, currentTracks, currentRecords);
  }

  shell.appendChild(overviewContent);
  app.appendChild(shell);
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
  window.location.hash = `#/session/${session.id}`;
  getSession(session.id).then(fullSession => renderSession(fullSession, currentSessions));
}

async function renderCarDrillDown(carModel) {
  app.innerHTML = '';
  try {
    const data = await getCarDrillDown(carModel);
    const shell = document.createElement('div');
    shell.className = 'dashboard-shell';

    const appBar = document.createElement('div');
    appBar.className = 'app-bar';
    const brand = document.createElement('h1');
    brand.className = 'app-bar__brand';
    brand.style.cursor = 'pointer';
    brand.textContent = 'BENTOCLUB';
    brand.addEventListener('click', () => { window.location.hash = '#/'; init(); });
    const status = document.createElement('span');
    status.className = 'app-bar__status';
    status.textContent = `${data.sessionCount || 0} sessions`;
    appBar.appendChild(brand);
    appBar.appendChild(status);
    shell.appendChild(appBar);

    const title = document.createElement('h2');
    title.className = 'session-header__track';
    title.style.fontSize = '1.5rem';
    title.textContent = carModel;
    shell.appendChild(title);

    if (data.entries && data.entries.length > 0) {
      const table = document.createElement('div');
      table.className = 'records-table';
      const header = document.createElement('div');
      header.className = 'records-table__header';
      for (const h of ['DRIVER', 'BEST LAP', 'GAP', 'DATE']) {
        const el = document.createElement('div');
        el.className = h === 'BEST LAP' ? 'records-table__col-time' : h === 'GAP' ? 'records-table__col-gap' : 'records-table__col-driver';
        el.textContent = h;
        header.appendChild(el);
      }
      table.appendChild(header);
      for (const e of data.entries) {
        const row = document.createElement('div');
        row.className = 'records-table__row';
        const driverEl = document.createElement('div');
        driverEl.className = 'records-table__col-driver';
        driverEl.textContent = e.driverName;
        const timeEl = document.createElement('div');
        timeEl.className = 'records-table__col-time';
        timeEl.textContent = formatTime(e.bestLapMs);
        const gapEl = document.createElement('div');
        gapEl.className = 'records-table__col-gap';
        gapEl.textContent = e.gapToLeaderMs === 0 ? '—' : `+${(e.gapToLeaderMs / 1000).toFixed(3)} s`;
        const dateEl = document.createElement('div');
        dateEl.className = 'records-table__col-date';
        dateEl.textContent = formatDateTime(e.importedAt);
        row.appendChild(driverEl);
        row.appendChild(timeEl);
        row.appendChild(gapEl);
        row.appendChild(dateEl);
        table.appendChild(row);
      }
      shell.appendChild(table);
    } else {
      const empty = document.createElement('div');
      empty.className = 'panel';
      empty.innerHTML = '<p class="empty-state">No valid lap records for this car.</p>';
      shell.appendChild(empty);
    }

    app.appendChild(shell);
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(createErrorState(err.message));
  }
}

async function renderDriverDrillDown(driverId) {
  app.innerHTML = '';
  try {
    const data = await getDriverDrillDown(driverId);
    const shell = document.createElement('div');
    shell.className = 'dashboard-shell';

    const appBar = document.createElement('div');
    appBar.className = 'app-bar';
    const brand = document.createElement('h1');
    brand.className = 'app-bar__brand';
    brand.style.cursor = 'pointer';
    brand.textContent = 'BENTOCLUB';
    brand.addEventListener('click', () => { window.location.hash = '#/'; init(); });
    const status = document.createElement('span');
    status.className = 'app-bar__status';
    status.textContent = `${data.sessionCount || 0} sessions`;
    appBar.appendChild(brand);
    appBar.appendChild(status);
    shell.appendChild(appBar);

    const driverName = data.entries?.[0]?.driverName || decodeURIComponent(driverId);
    const title = document.createElement('h2');
    title.className = 'session-header__track';
    title.style.fontSize = '1.5rem';
    title.textContent = driverName;
    shell.appendChild(title);

    if (data.entries && data.entries.length > 0) {
      const table = document.createElement('div');
      table.className = 'records-table';
      const header = document.createElement('div');
      header.className = 'records-table__header';
      for (const h of ['CAR', 'BEST LAP', 'GAP', 'DATE']) {
        const el = document.createElement('div');
        el.className = h === 'BEST LAP' ? 'records-table__col-time' : h === 'GAP' ? 'records-table__col-gap' : 'records-table__col-car';
        el.textContent = h;
        header.appendChild(el);
      }
      table.appendChild(header);
      for (const e of data.entries) {
        const row = document.createElement('div');
        row.className = 'records-table__row';
        const carEl = document.createElement('div');
        carEl.className = 'records-table__col-car';
        carEl.textContent = e.carModel;
        const timeEl = document.createElement('div');
        timeEl.className = 'records-table__col-time';
        timeEl.textContent = formatTime(e.bestLapMs);
        const gapEl = document.createElement('div');
        gapEl.className = 'records-table__col-gap';
        gapEl.textContent = e.gapToLeaderMs === 0 ? '—' : `+${(e.gapToLeaderMs / 1000).toFixed(3)} s`;
        const dateEl = document.createElement('div');
        dateEl.className = 'records-table__col-date';
        dateEl.textContent = formatDateTime(e.importedAt);
        row.appendChild(carEl);
        row.appendChild(timeEl);
        row.appendChild(gapEl);
        row.appendChild(dateEl);
        table.appendChild(row);
      }
      shell.appendChild(table);
    } else {
      const empty = document.createElement('div');
      empty.className = 'panel';
      empty.innerHTML = '<p class="empty-state">No valid lap records for this driver.</p>';
      shell.appendChild(empty);
    }

    app.appendChild(shell);
  } catch (err) {
    app.innerHTML = '';
    app.appendChild(createErrorState(err.message));
  }
}

function handleRouteChange() {
  const route = parseRoute();
  if (route.view === 'session' && route.id && route.id === currentSessionId) return;
  if (route.view === 'club') {
    const hash = window.location.hash || '#/';
    if (hash.startsWith('#/')) {
      const trackPart = hash.slice(2);
      if (trackPart) {
        const decoded = decodeURIComponent(trackPart);
        const sep = decoded.indexOf('|');
        if (sep !== -1) {
          selectedTrack = decoded.slice(0, sep);
          selectedLayout = decoded.slice(sep + 1);
        }
      }
    }
    loadClubData().then(() => renderClub());
  } else if (route.view === 'track' && route.id) {
    const decoded = decodeURIComponent(route.id);
    const sep = decoded.indexOf('|');
    if (sep !== -1) {
      selectedTrack = decoded.slice(0, sep);
      selectedLayout = decoded.slice(sep + 1);
      loadClubData().then(() => renderClub());
    }
  } else if (route.view === 'car' && route.id) {
    renderCarDrillDown(decodeURIComponent(route.id));
  } else if (route.view === 'driver' && route.id) {
    renderDriverDrillDown(decodeURIComponent(route.id));
  }
}

window.addEventListener('hashchange', handleRouteChange);

init();
