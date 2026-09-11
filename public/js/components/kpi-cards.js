import { formatTime, formatTimeDelta } from '../formatters.js';

export function createKpiCards(session) {
  const container = document.createElement('section');
  container.className = 'kpi-strip';
  container.setAttribute('aria-label', 'Key performance indicators');

  const classifiedCount = session.rankedDriverCount || 0;

  const invalidCount = session.invalidLapCount || 0;
  const validCount = session.validLapCount || 0;

  const cards = [
    {
      label: 'BEST LAP',
      value: session.bestValidLapMs !== null ? formatTime(session.bestValidLapMs) : 'NO VALID LAP',
      detail: session.bestValidLapMs !== null ? getBestLapDriver(session) : '',
    },
    {
      label: 'VALID LAPS',
      value: String(validCount),
      detail: invalidCount > 0
        ? `${invalidCount} invalid lap${invalidCount > 1 ? 's' : ''} excluded`
        : classifiedCount > 0 ? `${classifiedCount} driver${classifiedCount > 1 ? 's' : ''} with laps` : '',
    },
    {
      label: 'BEST IMPROVEMENT',
      value: session.largestValidImprovementMs !== null ? formatTimeDelta(session.largestValidImprovementMs) : '—',
      detail: session.largestValidImprovementMs !== null ? getImprovementDriver(session) : '',
    },
    {
      label: 'LEADER GAP',
      value: getLeaderGapValue(session),
      detail: getLeaderGapDetail(session),
    },
  ];

  for (const card of cards) {
    const el = document.createElement('article');
    el.className = 'kpi-card';

    const label = document.createElement('span');
    label.className = 'kpi-card__label';
    label.textContent = card.label;

    const value = document.createElement('strong');
    value.className = 'kpi-card__value';
    value.textContent = card.value;

    const detail = document.createElement('span');
    detail.className = 'kpi-card__detail';
    detail.textContent = card.detail;

    el.appendChild(label);
    el.appendChild(value);
    el.appendChild(detail);
    container.appendChild(el);
  }

  return container;
}

function getBestLapDriver(session) {
  if (!session.driverSummaries || session.bestValidLapMs === null) return '';
  return session.driverSummaries.find(driver => driver.bestValidLapMs === session.bestValidLapMs)?.driverName || '';
}

function getImprovementDriver(session) {
  if (!session.driverSummaries || session.largestValidImprovementMs === null) return '';
  return session.driverSummaries.find(driver => driver.driverId === session.largestValidImprovementDriverId)?.driverName || '';
}

function getLeaderGapValue(session) {
  if ((session.rankedDriverCount || 0) < 2 || session.leaderGapMs === null) return '—';
  if (session.leaderGapMs === 0) return 'TIE';
  return formatTimeDelta(session.leaderGapMs);
}

function getLeaderGapDetail(session) {
  if ((session.rankedDriverCount || 0) < 2 || session.leaderGapMs === null) return '';
  if (session.leaderGapMs === 0) return 'TIED LEADER';
  return 'P1 to P2';
}
